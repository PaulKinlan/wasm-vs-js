typedef unsigned char u8;
typedef unsigned int u32;
typedef unsigned long long u64;
#define INPUT_BYTES 128u
#define OUTPUT_CAPACITY 524288u
#define INPUT_MAGIC 0x31425243u
#define OUTPUT_MAGIC 0x314f5242u
#define HEADER_BYTES 256u
#define MAX_LOOPS 3u
#define MAX_POINTS 40u
#define MAX_SEGMENTS 104u
#define MAX_TRIANGLES 3000u

typedef struct { double x, y; } P2;
typedef struct { P2 a, b; } Segment;
typedef struct { Segment *edge; double x; } Hit;
static u8 input_data[INPUT_BYTES] __attribute__((aligned(16)));
static u8 output_data[OUTPUT_CAPACITY] __attribute__((aligned(16)));
static P2 loops[MAX_LOOPS][MAX_POINTS];
static u32 loop_lengths[MAX_LOOPS];
static Segment edge_data[MAX_SEGMENTS];
static double triangle_data[MAX_TRIANGLES * 9u];
static double ys[MAX_SEGMENTS];
static Hit hits[MAX_SEGMENTS];

static const double ux[32] = {
  1.0,0.9807852804032304,0.9238795325112867,0.8314696123025452,
  0.7071067811865476,0.5555702330196023,0.38268343236508984,0.19509032201612833,
  0.0,-0.19509032201612833,-0.38268343236508984,-0.5555702330196023,
  -0.7071067811865476,-0.8314696123025452,-0.9238795325112867,-0.9807852804032304,
  -1.0,-0.9807852804032304,-0.9238795325112867,-0.8314696123025452,
  -0.7071067811865476,-0.5555702330196023,-0.38268343236508984,-0.19509032201612833,
  0.0,0.19509032201612833,0.38268343236508984,0.5555702330196023,
  0.7071067811865476,0.8314696123025452,0.9238795325112867,0.9807852804032304
};
static const double uy[32] = {
  0.0,0.19509032201612825,0.3826834323650898,0.5555702330196022,
  0.7071067811865475,0.8314696123025452,0.9238795325112867,0.9807852804032304,
  1.0,0.9807852804032304,0.9238795325112867,0.8314696123025452,
  0.7071067811865475,0.5555702330196022,0.3826834323650898,0.19509032201612825,
  0.0,-0.19509032201612825,-0.3826834323650898,-0.5555702330196022,
  -0.7071067811865475,-0.8314696123025452,-0.9238795325112867,-0.9807852804032304,
  -1.0,-0.9807852804032304,-0.9238795325112867,-0.8314696123025452,
  -0.7071067811865475,-0.5555702330196022,-0.3826834323650898,-0.19509032201612825
};

u32 input_ptr(void) { return (u32)(unsigned long)input_data; }
u32 output_ptr(void) { return (u32)(unsigned long)output_data; }
static u32 read_u32(u32 off) { return *(u32 *)(input_data + off); }
static double read_f64(u32 off) { return *(double *)(input_data + off); }
static void write_u32(u32 off, u32 value) { *(u32 *)(output_data + off) = value; }
static void write_u64(u32 off, u64 value) { *(u64 *)(output_data + off) = value; }
static void write_f64(u32 off, double value) { *(double *)(output_data + off) = value; }
static double absd(double x) { return x < 0.0 ? -x : x; }
static void point(u32 loop, u32 *cursor, double x, double y) {
  loops[loop][*cursor].x = x; loops[loop][*cursor].y = y; (*cursor)++;
}
static u32 construct(double w, double h, double r, double hole_r, u32 hole_count) {
  u32 n = 0;
  point(0,&n,r,0.0); point(0,&n,w-r,0.0);
  for (u32 k=1;k<=8;k++) { u32 q=(24u+k)&31u; point(0,&n,w-r+r*ux[q],r+r*uy[q]); }
  point(0,&n,w,h-r);
  for (u32 k=1;k<=8;k++) point(0,&n,w-r+r*ux[k],h-r+r*uy[k]);
  point(0,&n,r,h);
  for (u32 k=1;k<=8;k++) { u32 q=8u+k; point(0,&n,r+r*ux[q],h-r+r*uy[q]); }
  point(0,&n,0.0,r);
  for (u32 k=1;k<8;k++) { u32 q=16u+k; point(0,&n,r+r*ux[q],r+r*uy[q]); }
  loop_lengths[0]=n;
  for (u32 hole=0;hole<hole_count;hole++) {
    u32 m=0; double cx=read_f64(64u+hole*16u), cy=read_f64(72u+hole*16u);
    for (u32 k=0;k<32;k++) { u32 q=(32u-k)&31u; point(1u+hole,&m,cx+hole_r*ux[q],cy+hole_r*uy[q]); }
    loop_lengths[1u+hole]=m;
  }
  return 1u+hole_count;
}
static double x_at(Segment *s, double y) {
  if (s->a.y == s->b.y) return s->a.x < s->b.x ? s->a.x : s->b.x;
  return s->a.x + (s->b.x-s->a.x)*((y-s->a.y)/(s->b.y-s->a.y));
}
static void add_triangle(u32 *count, double ax,double ay,double az,double bx,double by,double bz,double cx,double cy,double cz) {
  double area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  if (absd(area)<=1e-15 || *count>=MAX_TRIANGLES) return;
  u32 o=(*count)*9u;
  triangle_data[o]=ax;triangle_data[o+1]=ay;triangle_data[o+2]=az;
  triangle_data[o+3]=bx;triangle_data[o+4]=by;triangle_data[o+5]=bz;
  triangle_data[o+6]=cx;triangle_data[o+7]=cy;triangle_data[o+8]=cz;
  (*count)++;
}
static u32 tessellate(u32 loop_count,double depth,u64 *band_count,u64 *tests,u64 *comparisons) {
  u32 edge_count=0,y_count=0;
  for (u32 l=0;l<loop_count;l++) for (u32 i=0;i<loop_lengths[l];i++) {
    Segment *s=&edge_data[edge_count++]; s->a=loops[l][i]; s->b=loops[l][(i+1u)%loop_lengths[l]];
    ys[y_count++]=loops[l][i].y;
  }
  for (u32 i=1;i<y_count;i++) { double value=ys[i];u32 j=i;while(j>0&&ys[j-1]>value){ys[j]=ys[j-1];j--;}ys[j]=value; }
  u32 unique=0; for(u32 i=0;i<y_count;i++) if(i==0||ys[i]!=ys[i-1]) ys[unique++]=ys[i];
  u32 tri_count=0;
  for(u32 band=0;band+1u<unique;band++) {
    double y0=ys[band],y1=ys[band+1u]; if(!(y1>y0))continue; double mid=(y0+y1)*0.5;u32 hit_count=0;
    for(u32 e=0;e<edge_count;e++) {
      (*tests)++; Segment *s=&edge_data[e];double ay=s->a.y,by=s->b.y;
      if((ay<=mid&&mid<by)||(by<=mid&&mid<ay)) {
        Hit value={s,x_at(s,mid)};u32 j=hit_count++;hits[j]=value;
        while(j>0){(*comparisons)++;if(hits[j-1].x<=value.x)break;hits[j]=hits[j-1];j--;}hits[j]=value;
      }
    }
    if((hit_count&1u)!=0u)return 0u;(*band_count)++;
    for(u32 i=0;i<hit_count;i+=2u){Segment*l=hits[i].edge,*r=hits[i+1u].edge;double l0=x_at(l,y0),l1=x_at(l,y1),r0=x_at(r,y0),r1=x_at(r,y1);
      add_triangle(&tri_count,l0,y0,depth,r0,y0,depth,r1,y1,depth);
      add_triangle(&tri_count,l0,y0,depth,r1,y1,depth,l1,y1,depth);
      add_triangle(&tri_count,l0,y0,0.0,r1,y1,0.0,r0,y0,0.0);
      add_triangle(&tri_count,l0,y0,0.0,l1,y1,0.0,r1,y1,0.0);
    }
  }
  for(u32 l=0;l<loop_count;l++)for(u32 i=0;i<loop_lengths[l];i++){P2 a=loops[l][i],b=loops[l][(i+1u)%loop_lengths[l]];
    add_triangle(&tri_count,a.x,a.y,0.0,b.x,b.y,0.0,b.x,b.y,depth);
    add_triangle(&tri_count,a.x,a.y,0.0,b.x,b.y,depth,a.x,a.y,depth);
  }
  return tri_count;
}

u32 run(void) {
  if(read_u32(0)!=INPUT_MAGIC||read_u32(4)!=1u||read_u32(8)>2u||read_u32(12)!=8u||read_u32(16)!=32u)return 0u;
  u32 hole_count=read_u32(8);double w=read_f64(24),h=read_f64(32),depth=read_f64(40),fillet=read_f64(48),hole_r=read_f64(56);
  if(!(w>0.0&&h>0.0&&depth>0.0&&fillet>=0.0&&fillet*2.0<(w<h?w:h)))return 0u;
  u32 loop_count=construct(w,h,fillet,hole_r,hole_count);u64 bands=0,tests=0,comparisons=0;u32 triangle_count=tessellate(loop_count,depth,&bands,&tests,&comparisons);if(triangle_count==0u)return 0u;
  u32 loop_values=0;for(u32 l=0;l<loop_count;l++)loop_values+=loop_lengths[l]*2u;u32 output_bytes=HEADER_BYTES+loop_values*8u+triangle_count*72u;if(output_bytes>OUTPUT_CAPACITY)return 0u;
  for(u32 i=0;i<HEADER_BYTES;i++)output_data[i]=0;
  write_u32(0,OUTPUT_MAGIC);write_u32(4,1u);write_u32(8,loop_lengths[0]);write_u32(12,hole_count);write_u32(16,32u);write_u32(20,triangle_count);
  write_u32(24,12u);write_u32(28,30u);write_u32(32,20u);write_u32(36,2u);
  u64 counters[12]={10u,1u,hole_count,hole_count,fillet>0.0?4u:0u,bands,tests,comparisons,triangle_count,(u64)triangle_count*3u,INPUT_BYTES,output_bytes};
  for(u32 i=0;i<12;i++)write_u64(64u+i*8u,counters[i]);
  u32 off=HEADER_BYTES;for(u32 l=0;l<loop_count;l++)for(u32 i=0;i<loop_lengths[l];i++){write_f64(off,loops[l][i].x);off+=8u;write_f64(off,loops[l][i].y);off+=8u;}
  for(u32 i=0;i<triangle_count*9u;i++){write_f64(off,triangle_data[i]);off+=8u;}
  return output_bytes;
}
