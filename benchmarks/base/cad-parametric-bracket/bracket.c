typedef unsigned char u8;
typedef unsigned int u32;
typedef unsigned long long u64;
#define INPUT_BYTES 128u
#define OUTPUT_CAPACITY 2097152u
#define INPUT_MAGIC 0x31425243u
#define OUTPUT_MAGIC 0x314f5242u
#define HEADER_BYTES 256u
#define MAX_LOOPS 3u
#define MAX_POINTS 40u
#define MAX_SEGMENTS 104u
#define MAX_TRIANGLES 20000u

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
static double xs[MAX_SEGMENTS];
static double bottom_cuts[MAX_SEGMENTS + 2u];
static double top_cuts[MAX_SEGMENTS + 2u];
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
static u32 construct(double w, double h, double r, double hole_r, u32 hole_count, u64 *boolean_tests) {
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
    for (u32 k=0;k<32;k++) {
      u32 q=(32u-k)&31u; double x=cx+hole_r*ux[q],y=cy+hole_r*uy[q];
      double qx=x<r?r-x:(x>w-r?x-(w-r):0.0),qy=y<r?r-y:(y>h-r?y-(h-r):0.0);
      (*boolean_tests)++;
      if(x<0.0||x>w||y<0.0||y>h||qx*qx+qy*qy>r*r+1e-15)return 0u;
      point(1u+hole,&m,x,y);
    }
    loop_lengths[1u+hole]=m;
  }
  return 1u+hole_count;
}
static double x_at(Segment *s, double y) {
  if (s->a.y == s->b.y) return s->a.x < s->b.x ? s->a.x : s->b.x;
  return s->a.x + (s->b.x-s->a.x)*((y-s->a.y)/(s->b.y-s->a.y));
}
static void add_triangle(u32 *count, double ax,double ay,double az,double bx,double by,double bz,double cx,double cy,double cz) {
  double abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az;
  double nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  if (nx*nx+ny*ny+nz*nz<=1e-30 || *count>=MAX_TRIANGLES) return;
  u32 o=(*count)*9u;
  triangle_data[o]=ax;triangle_data[o+1]=ay;triangle_data[o+2]=az;
  triangle_data[o+3]=bx;triangle_data[o+4]=by;triangle_data[o+5]=bz;
  triangle_data[o+6]=cx;triangle_data[o+7]=cy;triangle_data[o+8]=cz;
  (*count)++;
}
static u32 tessellate(u32 loop_count,double depth,u64 *band_count,u64 *tests,u64 *comparisons) {
  u32 edge_count=0,y_count=0,x_count=0;
  for (u32 l=0;l<loop_count;l++) for (u32 i=0;i<loop_lengths[l];i++) {
    Segment *s=&edge_data[edge_count++]; s->a=loops[l][i]; s->b=loops[l][(i+1u)%loop_lengths[l]];
    ys[y_count++]=loops[l][i].y;xs[x_count++]=loops[l][i].x;
  }
  for (u32 i=1;i<y_count;i++) { double value=ys[i];u32 j=i;while(j>0&&ys[j-1]>value){ys[j]=ys[j-1];j--;}ys[j]=value; }
  u32 unique=0; for(u32 i=0;i<y_count;i++) if(i==0||ys[i]!=ys[i-1]) ys[unique++]=ys[i];
  for (u32 i=1;i<x_count;i++) { double value=xs[i];u32 j=i;while(j>0&&xs[j-1]>value){xs[j]=xs[j-1];j--;}xs[j]=value; }
  u32 unique_x=0; for(u32 i=0;i<x_count;i++) if(i==0||xs[i]!=xs[i-1]) xs[unique_x++]=xs[i];
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
      u32 bottom_count=0,top_count=0;
      bottom_cuts[bottom_count++]=l0;for(u32 q=0;q<unique_x;q++)if(xs[q]>l0&&xs[q]<r0)bottom_cuts[bottom_count++]=xs[q];if(r0!=l0)bottom_cuts[bottom_count++]=r0;
      top_cuts[top_count++]=l1;for(u32 q=0;q<unique_x;q++)if(xs[q]>l1&&xs[q]<r1)top_cuts[top_count++]=xs[q];if(r1!=l1)top_cuts[top_count++]=r1;
      u32 bi=0,ti=0;while(bi+1u<bottom_count||ti+1u<top_count){
        double bp=bi+1u<bottom_count?(bottom_cuts[bi+1u]-l0)/(r0-l0):1.7976931348623157e308;
        double tp=ti+1u<top_count?(top_cuts[ti+1u]-l1)/(r1-l1):1.7976931348623157e308;
        if(bp<=tp){
          add_triangle(&tri_count,bottom_cuts[bi],y0,depth,bottom_cuts[bi+1u],y0,depth,top_cuts[ti],y1,depth);
          add_triangle(&tri_count,bottom_cuts[bi],y0,0.0,top_cuts[ti],y1,0.0,bottom_cuts[bi+1u],y0,0.0);bi++;
        }else{
          add_triangle(&tri_count,bottom_cuts[bi],y0,depth,top_cuts[ti+1u],y1,depth,top_cuts[ti],y1,depth);
          add_triangle(&tri_count,bottom_cuts[bi],y0,0.0,top_cuts[ti],y1,0.0,top_cuts[ti+1u],y1,0.0);ti++;
        }
      }
    }
  }
  for(u32 l=0;l<loop_count;l++)for(u32 i=0;i<loop_lengths[l];i++){
    Segment side={loops[l][i],loops[l][(i+1u)%loop_lengths[l]]};P2 a=side.a,b=side.b;
    if(a.y==b.y){
      u32 have=0;double prior=0.0;
      if(a.x<b.x){for(u32 q=0;q<unique_x;q++)if(xs[q]>=a.x&&xs[q]<=b.x){
        if(have){add_triangle(&tri_count,prior,a.y,0.0,xs[q],a.y,0.0,xs[q],a.y,depth);add_triangle(&tri_count,prior,a.y,0.0,xs[q],a.y,depth,prior,a.y,depth);}prior=xs[q];have=1;
      }}else{for(u32 q=unique_x;q>0;q--){u32 qi=q-1u;if(xs[qi]<=a.x&&xs[qi]>=b.x){
        if(have){add_triangle(&tri_count,prior,a.y,0.0,xs[qi],a.y,0.0,xs[qi],a.y,depth);add_triangle(&tri_count,prior,a.y,0.0,xs[qi],a.y,depth,prior,a.y,depth);}prior=xs[qi];have=1;
      }}}
    }else if(a.y<b.y){
      u32 have=0;double prior=0.0;
      for(u32 q=0;q<unique;q++)if(ys[q]>=a.y&&ys[q]<=b.y){
        if(have){double y0=prior,y1=ys[q],x0=x_at(&side,y0),x1=x_at(&side,y1);
          add_triangle(&tri_count,x0,y0,0.0,x1,y1,0.0,x1,y1,depth);
          add_triangle(&tri_count,x0,y0,0.0,x1,y1,depth,x0,y0,depth);
        }prior=ys[q];have=1;
      }
    }else{
      u32 have=0;double prior=0.0;
      for(u32 q=unique;q>0;q--){u32 qi=q-1u;if(ys[qi]<=a.y&&ys[qi]>=b.y){
        if(have){double y0=prior,y1=ys[qi],x0=x_at(&side,y0),x1=x_at(&side,y1);
          add_triangle(&tri_count,x0,y0,0.0,x1,y1,0.0,x1,y1,depth);
          add_triangle(&tri_count,x0,y0,0.0,x1,y1,depth,x0,y0,depth);
        }prior=ys[qi];have=1;
      }}
    }
  }
  return tri_count;
}

u32 run(void) {
  if(read_u32(0)!=INPUT_MAGIC||read_u32(4)!=1u||read_u32(8)>2u||read_u32(12)!=8u||read_u32(16)!=32u)return 0u;
  u32 hole_count=read_u32(8);double w=read_f64(24),h=read_f64(32),depth=read_f64(40),fillet=read_f64(48),hole_r=read_f64(56);
  if(!(w>0.0&&h>0.0&&depth>0.0&&fillet>=0.0&&fillet*2.0<(w<h?w:h)))return 0u;
  u64 boolean_tests=0;u32 loop_count=construct(w,h,fillet,hole_r,hole_count,&boolean_tests);if(loop_count==0u)return 0u;
  u64 bands=0,tests=0,comparisons=0;u32 triangle_count=tessellate(loop_count,depth,&bands,&tests,&comparisons);if(triangle_count==0u)return 0u;
  u32 loop_values=0;for(u32 l=0;l<loop_count;l++)loop_values+=loop_lengths[l]*2u;u32 output_bytes=HEADER_BYTES+loop_values*8u+triangle_count*72u;if(output_bytes>OUTPUT_CAPACITY)return 0u;
  for(u32 i=0;i<HEADER_BYTES;i++)output_data[i]=0;
  write_u32(0,OUTPUT_MAGIC);write_u32(4,1u);write_u32(8,loop_lengths[0]);write_u32(12,hole_count);write_u32(16,32u);write_u32(20,triangle_count);
  write_u32(24,12u);write_u32(28,30u);write_u32(32,20u);write_u32(36,2u);
  u64 counters[13]={10u,1u,hole_count,hole_count,fillet>0.0?4u:0u,boolean_tests,bands,tests,comparisons,triangle_count,(u64)triangle_count*3u,INPUT_BYTES,output_bytes};
  for(u32 i=0;i<13;i++)write_u64(64u+i*8u,counters[i]);
  u32 off=HEADER_BYTES;for(u32 l=0;l<loop_count;l++)for(u32 i=0;i<loop_lengths[l];i++){write_f64(off,loops[l][i].x);off+=8u;write_f64(off,loops[l][i].y);off+=8u;}
  for(u32 i=0;i<triangle_count*9u;i++){write_f64(off,triangle_data[i]);off+=8u;}
  return output_bytes;
}
