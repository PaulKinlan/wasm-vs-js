typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;
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
#define MAX_BREP_VERTICES 24u
#define MAX_BREP_EDGES 36u
#define MAX_BREP_FACES 16u
#define MAX_BREP_LOOPS 20u
#define MAX_BREP_COEDGES 72u
#define MAX_FACE_LOOPS 3u
#define MAX_LOOP_COEDGES 8u

typedef struct { double x, y; } P2;
typedef struct { P2 a, b; } Segment;
typedef struct { Segment *edge; double x; } Hit;
typedef enum { SURFACE_PLANE = 1u, SURFACE_CYLINDER = 2u } SurfaceKind;
typedef enum { CURVE_LINE = 1u, CURVE_CIRCLE = 2u } CurveKind;
typedef struct { double x, y, z; } BrepVertex;
typedef struct {
  CurveKind curve; u32 v0, v1, start_index, steps, coedges[2], coedge_count;
  double cx, cy, radius;
} BrepEdge;
typedef struct {
  SurfaceKind surface; u32 loops[MAX_FACE_LOOPS], loop_count;
  double cx, cy, radius;
} BrepFace;
typedef struct { u32 face, coedges[MAX_LOOP_COEDGES], coedge_count; } BrepLoop;
typedef struct {
  u32 edge, face, loop, next, previous;
  i32 orientation;
} BrepCoedge;
typedef struct {
  BrepVertex vertices[MAX_BREP_VERTICES];
  BrepEdge edges[MAX_BREP_EDGES];
  BrepFace faces[MAX_BREP_FACES];
  BrepLoop brep_loops[MAX_BREP_LOOPS];
  BrepCoedge coedges[MAX_BREP_COEDGES];
  u32 vertex_count, edge_count, face_count, loop_count, coedge_count, hole_count;
  u64 feature_nodes, box_solids, cylinder_solids, boolean_cuts, fillet_edges;
} BrepSolid;
typedef struct {
  u32 connected_components, shells, genus;
  i32 euler_characteristic;
} BrepTopology;
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
static BrepSolid brep;
static BrepSolid cylinder_tool;

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
static void write_i32(u32 off, i32 value) { *(i32 *)(output_data + off) = value; }
static void write_u64(u32 off, u64 value) { *(u64 *)(output_data + off) = value; }
static void write_f64(u32 off, double value) { *(double *)(output_data + off) = value; }
static u32 finite_value(double value) {
  return value == value && value <= 1.7976931348623157e308 && value >= -1.7976931348623157e308;
}
static void point(u32 loop, u32 *cursor, double x, double y) {
  loops[loop][*cursor].x = x; loops[loop][*cursor].y = y; (*cursor)++;
}
static void init_solid(BrepSolid *solid) {
  solid->vertex_count=0u;solid->edge_count=0u;solid->face_count=0u;
  solid->loop_count=0u;solid->coedge_count=0u;solid->hole_count=0u;
  solid->feature_nodes=0u;solid->box_solids=0u;solid->cylinder_solids=0u;
  solid->boolean_cuts=0u;solid->fillet_edges=0u;
  for(u32 i=0;i<MAX_BREP_EDGES;i++)solid->edges[i].coedge_count=0u;
  for(u32 i=0;i<MAX_BREP_FACES;i++)solid->faces[i].loop_count=0u;
}
static u32 add_vertex(BrepSolid *solid,double x,double y,double z){
  u32 id=solid->vertex_count++;solid->vertices[id].x=x;solid->vertices[id].y=y;solid->vertices[id].z=z;return id;
}
static u32 add_face(BrepSolid *solid,SurfaceKind surface,double cx,double cy,double radius){
  u32 id=solid->face_count++;solid->faces[id].surface=surface;solid->faces[id].cx=cx;
  solid->faces[id].cy=cy;solid->faces[id].radius=radius;solid->faces[id].loop_count=0u;return id;
}
static void configure_edge(BrepSolid *solid,u32 id,CurveKind curve,u32 v0,u32 v1,
  double cx,double cy,double radius,u32 start,u32 steps){
  BrepEdge *edge=&solid->edges[id];edge->curve=curve;edge->v0=v0;edge->v1=v1;
  edge->cx=cx;edge->cy=cy;edge->radius=radius;edge->start_index=start;edge->steps=steps;
  edge->coedge_count=0u;
}
static u32 add_edge(BrepSolid *solid,CurveKind curve,u32 v0,u32 v1,
  double cx,double cy,double radius,u32 start,u32 steps){
  u32 id=solid->edge_count++;configure_edge(solid,id,curve,v0,v1,cx,cy,radius,start,steps);return id;
}
static u32 add_loop(BrepSolid *solid,u32 face,const u32 *edge_ids,const i32 *orientations,u32 count){
  u32 loop_id=solid->loop_count++;BrepLoop *loop=&solid->brep_loops[loop_id];
  loop->face=face;loop->coedge_count=count;solid->faces[face].loops[solid->faces[face].loop_count++]=loop_id;
  for(u32 i=0;i<count;i++){
    u32 coedge_id=solid->coedge_count++;BrepCoedge *coedge=&solid->coedges[coedge_id];
    coedge->edge=edge_ids[i];coedge->face=face;coedge->loop=loop_id;coedge->orientation=orientations[i];
    loop->coedges[i]=coedge_id;BrepEdge *edge=&solid->edges[edge_ids[i]];
    edge->coedges[edge->coedge_count++]=coedge_id;
  }
  for(u32 i=0;i<count;i++){
    BrepCoedge *coedge=&solid->coedges[loop->coedges[i]];
    coedge->previous=loop->coedges[(i+count-1u)%count];coedge->next=loop->coedges[(i+1u)%count];
  }
  return loop_id;
}
static void reset_incidence(BrepSolid *solid){
  solid->loop_count=0u;solid->coedge_count=0u;
  for(u32 i=0;i<solid->edge_count;i++)solid->edges[i].coedge_count=0u;
  for(u32 i=0;i<solid->face_count;i++)solid->faces[i].loop_count=0u;
}
static void make_box_solid(BrepSolid *solid,double w,double h,double depth) {
  init_solid(solid);double px[4]={0.0,w,w,0.0},py[4]={0.0,0.0,h,h};
  for(u32 z=0;z<2u;z++)for(u32 i=0;i<4u;i++)add_vertex(solid,px[i],py[i],z?depth:0.0);
  u32 bottom=add_face(solid,SURFACE_PLANE,0.0,0.0,0.0),top=add_face(solid,SURFACE_PLANE,0.0,0.0,0.0);
  u32 sides[4];for(u32 i=0;i<4u;i++)sides[i]=add_face(solid,SURFACE_PLANE,0.0,0.0,0.0);
  u32 bottom_edges[4],top_edges[4],vertical[4];
  for(u32 i=0;i<4u;i++){
    bottom_edges[i]=add_edge(solid,CURVE_LINE,i,(i+1u)%4u,0.0,0.0,0.0,0u,0u);
    top_edges[i]=add_edge(solid,CURVE_LINE,4u+i,4u+(i+1u)%4u,0.0,0.0,0.0,0u,0u);
    vertical[i]=add_edge(solid,CURVE_LINE,i,4u+i,0.0,0.0,0.0,0u,0u);
  }
  u32 bottom_loop[4]={bottom_edges[3],bottom_edges[2],bottom_edges[1],bottom_edges[0]};
  i32 negative[4]={-1,-1,-1,-1},positive[4]={1,1,1,1};
  add_loop(solid,bottom,bottom_loop,negative,4u);add_loop(solid,top,top_edges,positive,4u);
  for(u32 i=0;i<4u;i++){
    u32 side_loop[4]={bottom_edges[i],vertical[(i+1u)%4u],top_edges[i],vertical[i]};
    i32 side_orientation[4]={1,1,-1,-1};add_loop(solid,sides[i],side_loop,side_orientation,4u);
  }
  solid->feature_nodes++;solid->box_solids++;
}
static void make_cylinder_solid(BrepSolid *tool,double cx,double cy,double radius,double depth) {
  init_solid(tool);u32 v0=add_vertex(tool,cx+radius,cy,0.0),v1=add_vertex(tool,cx+radius,cy,depth);
  u32 bottom=add_face(tool,SURFACE_PLANE,0.0,0.0,0.0),top=add_face(tool,SURFACE_PLANE,0.0,0.0,0.0);
  u32 wall=add_face(tool,SURFACE_CYLINDER,cx,cy,radius);
  u32 rim0=add_edge(tool,CURVE_CIRCLE,v0,v0,cx,cy,radius,0u,32u);
  u32 rim1=add_edge(tool,CURVE_CIRCLE,v1,v1,cx,cy,radius,0u,32u);
  u32 seam=add_edge(tool,CURVE_LINE,v0,v1,0.0,0.0,0.0,0u,0u);
  u32 one[1];i32 orientation[1];one[0]=rim0;orientation[0]=-1;add_loop(tool,bottom,one,orientation,1u);
  one[0]=rim1;orientation[0]=1;add_loop(tool,top,one,orientation,1u);
  u32 wall_edges[4]={rim0,seam,rim1,seam};i32 wall_orientation[4]={1,1,-1,-1};
  add_loop(tool,wall,wall_edges,wall_orientation,4u);tool->feature_nodes++;tool->cylinder_solids++;
}
static u32 validate_brep(BrepSolid *solid,BrepTopology *topology){
  if(solid->face_count==0u)return 0u;
  for(u32 edge=0;edge<solid->edge_count;edge++){
    BrepEdge *item=&solid->edges[edge];if(item->v0>=solid->vertex_count||item->v1>=solid->vertex_count||item->coedge_count!=2u)return 0u;
    BrepCoedge *a=&solid->coedges[item->coedges[0]],*b=&solid->coedges[item->coedges[1]];
    if(a->edge!=edge||b->edge!=edge||a->orientation+b->orientation!=0)return 0u;
  }
  for(u32 face=0;face<solid->face_count;face++){
    BrepFace *item=&solid->faces[face];if(item->loop_count==0u)return 0u;
    for(u32 li=0;li<item->loop_count;li++){
      u32 loop_id=item->loops[li];if(loop_id>=solid->loop_count)return 0u;BrepLoop *loop=&solid->brep_loops[loop_id];
      if(loop->face!=face||loop->coedge_count==0u)return 0u;
      for(u32 i=0;i<loop->coedge_count;i++){
        u32 id=loop->coedges[i];if(id>=solid->coedge_count)return 0u;BrepCoedge *coedge=&solid->coedges[id];
        if(coedge->face!=face||coedge->loop!=loop_id||coedge->previous!=loop->coedges[(i+loop->coedge_count-1u)%loop->coedge_count]||coedge->next!=loop->coedges[(i+1u)%loop->coedge_count])return 0u;
      }
    }
  }
  u32 visited[MAX_BREP_FACES]={0},components=0u;
  for(u32 start=0;start<solid->face_count;start++)if(!visited[start]){
    u32 queue[MAX_BREP_FACES],head=0u,tail=0u;queue[tail++]=start;visited[start]=1u;components++;
    while(head<tail){u32 face=queue[head++];for(u32 edge=0;edge<solid->edge_count;edge++){
      BrepEdge *item=&solid->edges[edge];u32 a=solid->coedges[item->coedges[0]].face,b=solid->coedges[item->coedges[1]].face;
      u32 next=a==face?b:(b==face?a:MAX_BREP_FACES);if(next<solid->face_count&&!visited[next]){visited[next]=1u;queue[tail++]=next;}
    }}
  }
  i32 euler=(i32)solid->vertex_count-(i32)solid->edge_count+(i32)solid->face_count-((i32)solid->loop_count-(i32)solid->face_count);
  i32 twice_genus=(i32)(2u*components)-euler;if(twice_genus<0||(twice_genus&1)!=0)return 0u;
  topology->connected_components=components;topology->shells=components;topology->euler_characteristic=euler;topology->genus=(u32)(twice_genus/2);return 1u;
}
static u32 boolean_cut(BrepSolid *solid,BrepSolid *tool,double w,double h,double fillet,u64 *boolean_tests) {
  BrepTopology tool_topology;if(!validate_brep(tool,&tool_topology)||tool_topology.genus!=0u)return 0u;
  BrepFace *cylinder=&tool->faces[2];double cx=cylinder->cx,cy=cylinder->cy,radius=cylinder->radius;
  for(u32 k=0;k<32u;k++){
    double x=cx+radius*ux[k],y=cy+radius*uy[k];double qx=x<fillet?fillet-x:(x>w-fillet?x-(w-fillet):0.0);
    double qy=y<fillet?fillet-y:(y>h-fillet?y-(h-fillet):0.0);(*boolean_tests)++;
    if(x<0.0||x>w||y<0.0||y>h||qx*qx+qy*qy>fillet*fillet+1e-15)return 0u;
  }
  u32 v0=add_vertex(solid,tool->vertices[0].x,tool->vertices[0].y,tool->vertices[0].z);
  u32 v1=add_vertex(solid,tool->vertices[1].x,tool->vertices[1].y,tool->vertices[1].z);
  u32 wall=add_face(solid,SURFACE_CYLINDER,cx,cy,radius);
  u32 rim0=add_edge(solid,CURVE_CIRCLE,v0,v0,cx,cy,radius,0u,32u);
  u32 rim1=add_edge(solid,CURVE_CIRCLE,v1,v1,cx,cy,radius,0u,32u);
  u32 seam=add_edge(solid,CURVE_LINE,v0,v1,0.0,0.0,0.0,0u,0u);
  u32 one[1];i32 orientation[1];one[0]=rim0;orientation[0]=1;add_loop(solid,0u,one,orientation,1u);
  one[0]=rim1;orientation[0]=-1;add_loop(solid,1u,one,orientation,1u);
  u32 wall_edges[4]={rim0,seam,rim1,seam};i32 wall_orientation[4]={-1,1,1,-1};
  add_loop(solid,wall,wall_edges,wall_orientation,4u);
  solid->hole_count++;solid->feature_nodes+=2u;solid->cylinder_solids++;solid->boolean_cuts++;
  BrepTopology topology;return validate_brep(solid,&topology);
}
static P2 profile_point(u32 i,double w,double h,double r){
  P2 p;double px[8]={r,w-r,w,w,w-r,r,0.0,0.0},py[8]={0.0,0.0,r,h-r,h,h,h-r,r};p.x=px[i];p.y=py[i];return p;
}
static void profile_curve(u32 i,double w,double h,double r,double *cx,double *cy,u32 *start){
  *cx=0.0;*cy=0.0;*start=0u;if(i==1u){*cx=w-r;*cy=r;*start=24u;}else if(i==3u){*cx=w-r;*cy=h-r;*start=0u;}else if(i==5u){*cx=r;*cy=h-r;*start=8u;}else if(i==7u){*cx=r;*cy=r;*start=16u;}
}
static u32 fillet_vertical_edges(BrepSolid *solid,double w,double h,double depth,double radius) {
  if(radius==0.0)return 1u;u32 holes=solid->hole_count;
  u32 bottom_vertices[8]={0},top_vertices[8]={4};
  for(u32 i=1;i<8u;i++){P2 p=profile_point(i,w,h,radius);if((i&1u)==0u){bottom_vertices[i]=i/2u;top_vertices[i]=4u+i/2u;}else{bottom_vertices[i]=add_vertex(solid,p.x,p.y,0.0);top_vertices[i]=add_vertex(solid,p.x,p.y,depth);}}
  for(u32 i=0;i<8u;i+=2u){P2 p=profile_point(i,w,h,radius);solid->vertices[bottom_vertices[i]].x=p.x;solid->vertices[bottom_vertices[i]].y=p.y;solid->vertices[bottom_vertices[i]].z=0.0;solid->vertices[top_vertices[i]].x=p.x;solid->vertices[top_vertices[i]].y=p.y;solid->vertices[top_vertices[i]].z=depth;}
  u32 bottom_edges[8],top_edges[8],vertical[8],sides[8];
  for(u32 i=0;i<8u;i++){u32 next=(i+1u)%8u;double cx,cy;u32 start;profile_curve(i,w,h,radius,&cx,&cy,&start);CurveKind curve=(i&1u)?CURVE_CIRCLE:CURVE_LINE;
    if((i&1u)==0u){bottom_edges[i]=i/2u;top_edges[i]=4u+i/2u;vertical[i]=8u+i/2u;sides[i]=2u+i/2u;
      configure_edge(solid,bottom_edges[i],curve,bottom_vertices[i],bottom_vertices[next],cx,cy,radius,start,curve==CURVE_CIRCLE?8u:0u);
      configure_edge(solid,top_edges[i],curve,top_vertices[i],top_vertices[next],cx,cy,radius,start,curve==CURVE_CIRCLE?8u:0u);
      configure_edge(solid,vertical[i],CURVE_LINE,bottom_vertices[i],top_vertices[i],0.0,0.0,0.0,0u,0u);solid->faces[sides[i]].surface=SURFACE_PLANE;
    }else{bottom_edges[i]=add_edge(solid,curve,bottom_vertices[i],bottom_vertices[next],cx,cy,radius,start,8u);
      top_edges[i]=add_edge(solid,curve,top_vertices[i],top_vertices[next],cx,cy,radius,start,8u);
      vertical[i]=add_edge(solid,CURVE_LINE,bottom_vertices[i],top_vertices[i],0.0,0.0,0.0,0u,0u);
      sides[i]=add_face(solid,SURFACE_CYLINDER,cx,cy,radius);solid->feature_nodes++;solid->fillet_edges++;
    }
  }
  if(solid->vertex_count!=16u+2u*holes||solid->edge_count!=24u+3u*holes||solid->face_count!=10u+holes)return 0u;
  reset_incidence(solid);u32 reverse_bottom[8];i32 negative[8],positive[8];for(u32 i=0;i<8u;i++){reverse_bottom[i]=bottom_edges[7u-i];negative[i]=-1;positive[i]=1;}
  add_loop(solid,0u,reverse_bottom,negative,8u);add_loop(solid,1u,top_edges,positive,8u);
  for(u32 i=0;i<8u;i++){u32 side_loop[4]={bottom_edges[i],vertical[(i+1u)%8u],top_edges[i],vertical[i]};i32 orientation[4]={1,1,-1,-1};add_loop(solid,sides[i],side_loop,orientation,4u);}
  for(u32 hole=0;hole<holes;hole++){u32 wall=6u+hole,edge=12u+hole*3u,one[1];i32 orientation[1];one[0]=edge;orientation[0]=1;add_loop(solid,0u,one,orientation,1u);one[0]=edge+1u;orientation[0]=-1;add_loop(solid,1u,one,orientation,1u);u32 wall_edges[4]={edge,edge+2u,edge+1u,edge+2u};i32 wall_orientation[4]={-1,1,1,-1};add_loop(solid,wall,wall_edges,wall_orientation,4u);}
  BrepTopology topology;return validate_brep(solid,&topology);
}
static u32 construct_face_loops_from_brep(BrepSolid *solid,u32 face){
  BrepFace *plane=&solid->faces[face];if(plane->loop_count>MAX_LOOPS)return 0u;
  for(u32 li=0;li<plane->loop_count;li++){BrepLoop *loop=&solid->brep_loops[plane->loops[li]];u32 cursor=0u;
    for(u32 ci=0;ci<loop->coedge_count;ci++){BrepCoedge *coedge=&solid->coedges[loop->coedges[ci]];BrepEdge *edge=&solid->edges[coedge->edge];
      if(edge->curve==CURVE_LINE){u32 vertex=coedge->orientation>0?edge->v0:edge->v1;point(li,&cursor,solid->vertices[vertex].x,solid->vertices[vertex].y);}
      else if(coedge->orientation>0){for(u32 step=0;step<edge->steps;step++){u32 q=(edge->start_index+step)&31u;point(li,&cursor,edge->cx+edge->radius*ux[q],edge->cy+edge->radius*uy[q]);}}
      else{for(u32 step=edge->steps;step>0u;step--){u32 q=(edge->start_index+step)&31u;point(li,&cursor,edge->cx+edge->radius*ux[q],edge->cy+edge->radius*uy[q]);}}
    }
    loop_lengths[li]=cursor;
  }
  return plane->loop_count;
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
static u32 tessellate_faces(u32 loop_count,double depth,u64 *band_count,u64 *tests,u64 *comparisons) {
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
  if(!finite_value(w)||!finite_value(h)||!finite_value(depth)||!finite_value(fillet)||!finite_value(hole_r)||!(w>0.0&&h>0.0&&depth>0.0&&fillet>=0.0&&hole_r>0.0&&fillet*2.0<(w<h?w:h)))return 0u;
  for(u32 hole=0;hole<hole_count;hole++){double cx=read_f64(64u+hole*16u),cy=read_f64(72u+hole*16u);if(!finite_value(cx)||!finite_value(cy))return 0u;}
  for(u32 a=0;a<hole_count;a++)for(u32 b=a+1u;b<hole_count;b++){double dx=read_f64(64u+a*16u)-read_f64(64u+b*16u),dy=read_f64(72u+a*16u)-read_f64(72u+b*16u);if(dx*dx+dy*dy<=4.0*hole_r*hole_r)return 0u;}
  make_box_solid(&brep,w,h,depth);u64 boolean_tests=0u;
  for(u32 hole=0;hole<hole_count;hole++){double cx=read_f64(64u+hole*16u),cy=read_f64(72u+hole*16u);make_cylinder_solid(&cylinder_tool,cx,cy,hole_r,depth);if(!boolean_cut(&brep,&cylinder_tool,w,h,fillet,&boolean_tests))return 0u;}
  if(!fillet_vertical_edges(&brep,w,h,depth,fillet))return 0u;brep.feature_nodes++;
  BrepTopology topology;if(!validate_brep(&brep,&topology)||topology.genus!=hole_count)return 0u;
  u32 loop_count=construct_face_loops_from_brep(&brep,1u);if(loop_count==0u)return 0u;
  u64 bands=0,tests=0,comparisons=0;u32 triangle_count=tessellate_faces(loop_count,depth,&bands,&tests,&comparisons);if(triangle_count==0u)return 0u;
  u32 loop_values=0;for(u32 l=0;l<loop_count;l++)loop_values+=loop_lengths[l]*2u;u32 output_bytes=HEADER_BYTES+loop_values*8u+triangle_count*72u;if(output_bytes>OUTPUT_CAPACITY)return 0u;
  for(u32 i=0;i<HEADER_BYTES;i++)output_data[i]=0;
  write_u32(0,OUTPUT_MAGIC);write_u32(4,2u);write_u32(8,loop_lengths[0]);write_u32(12,hole_count);write_u32(16,32u);write_u32(20,triangle_count);
  write_u32(24,brep.face_count);write_u32(28,brep.edge_count);write_u32(32,brep.vertex_count);write_u32(36,topology.genus);write_u32(40,brep.coedge_count);write_u32(44,brep.loop_count);write_i32(48,topology.euler_characteristic);write_u32(52,topology.connected_components);write_u32(56,topology.shells);write_u32(60,0u);
  u64 counters[13]={brep.feature_nodes,brep.box_solids,brep.cylinder_solids,brep.boolean_cuts,brep.fillet_edges,boolean_tests,bands,tests,comparisons,triangle_count,(u64)triangle_count*3u,INPUT_BYTES,output_bytes};
  for(u32 i=0;i<13;i++)write_u64(64u+i*8u,counters[i]);
  u32 off=HEADER_BYTES;for(u32 l=0;l<loop_count;l++)for(u32 i=0;i<loop_lengths[l];i++){write_f64(off,loops[l][i].x);off+=8u;write_f64(off,loops[l][i].y);off+=8u;}
  for(u32 i=0;i<triangle_count*9u;i++){write_f64(off,triangle_data[i]);off+=8u;}return output_bytes;
}
