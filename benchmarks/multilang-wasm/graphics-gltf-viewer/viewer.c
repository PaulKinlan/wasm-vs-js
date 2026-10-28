#include <stdint.h>
#define FRAMES 600
#define WIDTH 96
#define HEIGHT 96
#define RETAINED_FRAMES 600
#define HEADER_WORDS 28
#define FRAME_WORDS 8
#define ROT_SCALE 1048576
#define NORMAL_SCALE 32767
#define FIXTURE_BYTES 3083
#define FIXTURE_FNV1A 0xea7d57a4u

static uint8_t heap[50331648];
uint32_t heap_ptr(void) { return (uint32_t)(uintptr_t)heap; }
uint32_t output_ptr(void) { return (uint32_t)(uintptr_t)(heap + 8000000); }
static int32_t div_trunc(int64_t v, int32_t d) { return (int32_t)(v / d); }
static uint32_t hash_word(uint32_t h, int32_t v) { return (h ^ (uint32_t)v) * 16777619u; }
static int64_t edge(int32_t ax,int32_t ay,int32_t bx,int32_t by,int32_t px,int32_t py) {
  return (int64_t)(px-ax)*(by-ay)-(int64_t)(py-ay)*(bx-ax);
}
static int is_pick(int f) { return f>=25 && f<=575 && ((f-25)%50)==0; }
static int32_t min3(int32_t a,int32_t b,int32_t c){int32_t m=a<b?a:b;return m<c?m:c;}
static int32_t max3(int32_t a,int32_t b,int32_t c){int32_t m=a>b?a:b;return m>c?m:c;}

typedef struct { const uint8_t *p; const uint8_t *end; uint32_t depth; } json_parser;
static void json_ws(json_parser *j) {
  while(j->p<j->end && (*j->p==' '||*j->p=='\n'||*j->p=='\r'||*j->p=='\t')) j->p++;
}
static int json_hex(uint8_t c) {
  return (c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F');
}
static int json_string(json_parser *j) {
  if(j->p>=j->end||*j->p!='"') return 0;
  j->p++;
  while(j->p<j->end) {
    uint8_t c=*j->p++;
    if(c=='"') return 1;
    if(c<0x20) return 0;
    if(c=='\\') {
      if(j->p>=j->end) return 0;
      c=*j->p++;
      if(c=='u') {
        for(int i=0;i<4;i++) if(j->p>=j->end||!json_hex(*j->p++)) return 0;
      } else if(!(c=='"'||c=='\\'||c=='/'||c=='b'||c=='f'||c=='n'||c=='r'||c=='t')) return 0;
    }
  }
  return 0;
}
static int json_number(json_parser *j) {
  const uint8_t *start=j->p;
  if(j->p<j->end&&*j->p=='-') j->p++;
  if(j->p>=j->end) return 0;
  if(*j->p=='0') j->p++;
  else {
    if(*j->p<'1'||*j->p>'9') return 0;
    while(j->p<j->end&&*j->p>='0'&&*j->p<='9') j->p++;
  }
  if(j->p<j->end&&*j->p=='.') {
    j->p++;
    if(j->p>=j->end||*j->p<'0'||*j->p>'9') return 0;
    while(j->p<j->end&&*j->p>='0'&&*j->p<='9') j->p++;
  }
  if(j->p<j->end&&(*j->p=='e'||*j->p=='E')) {
    j->p++;
    if(j->p<j->end&&(*j->p=='+'||*j->p=='-')) j->p++;
    if(j->p>=j->end||*j->p<'0'||*j->p>'9') return 0;
    while(j->p<j->end&&*j->p>='0'&&*j->p<='9') j->p++;
  }
  return j->p>start;
}
static int json_value(json_parser *j);
static int json_array(json_parser *j) {
  if(j->depth++>=64||j->p>=j->end||*j->p++!='[') return 0;
  json_ws(j);
  if(j->p<j->end&&*j->p==']') { j->p++; j->depth--; return 1; }
  for(;;) {
    if(!json_value(j)) return 0;
    json_ws(j);
    if(j->p>=j->end) return 0;
    if(*j->p==']') { j->p++; j->depth--; return 1; }
    if(*j->p++!=',') return 0;
    json_ws(j);
  }
}
static int json_object(json_parser *j) {
  if(j->depth++>=64||j->p>=j->end||*j->p++!='{') return 0;
  json_ws(j);
  if(j->p<j->end&&*j->p=='}') { j->p++; j->depth--; return 1; }
  for(;;) {
    if(!json_string(j)) return 0;
    json_ws(j);
    if(j->p>=j->end||*j->p++!=':') return 0;
    json_ws(j);
    if(!json_value(j)) return 0;
    json_ws(j);
    if(j->p>=j->end) return 0;
    if(*j->p=='}') { j->p++; j->depth--; return 1; }
    if(*j->p++!=',') return 0;
    json_ws(j);
  }
}
static int json_literal(json_parser *j,const char *s) {
  while(*s) { if(j->p>=j->end||*j->p++!=(uint8_t)*s++) return 0; }
  return 1;
}
static int json_value(json_parser *j) {
  json_ws(j);
  if(j->p>=j->end) return 0;
  if(*j->p=='{') return json_object(j);
  if(*j->p=='[') return json_array(j);
  if(*j->p=='"') return json_string(j);
  if(*j->p=='t') return json_literal(j,"true");
  if(*j->p=='f') return json_literal(j,"false");
  if(*j->p=='n') return json_literal(j,"null");
  return json_number(j);
}

int validate_gltf(uint32_t off,uint32_t len) {
  if(off>sizeof(heap)||len>sizeof(heap)-off) return -1;
  json_parser j={heap+off,heap+off+len,0};
  if(!json_value(&j)) return -2;
  json_ws(&j);
  if(j.p!=j.end) return -3;
  uint32_t hash=2166136261u;
  for(uint32_t i=0;i<len;i++) hash=(hash^heap[off+i])*16777619u;
  if(len!=FIXTURE_BYTES||hash!=FIXTURE_FNV1A) return -4;
  return 0;
}

int run(uint32_t pos_off,uint32_t norm_off,uint32_t uv_off,uint32_t index_off,uint32_t texture_off,uint32_t anim_off,uint32_t vertex_count,uint32_t index_count,uint32_t decoder_allocations,uint32_t decoder_api_calls,uint32_t decoder_boundaries){
  int32_t *pos=(int32_t*)(heap+pos_off),*norm=(int32_t*)(heap+norm_off),*uv=(int32_t*)(heap+uv_off);
  uint32_t *ind=(uint32_t*)(heap+index_off); uint8_t *texture=heap+texture_off; int32_t *anim=(int32_t*)(heap+anim_off);
  uint8_t *out=heap+8000000; uint32_t *words=(uint32_t*)out; int32_t *frame_words=(int32_t*)(out+HEADER_WORDS*4);
  uint8_t *pixel_base=out+(HEADER_WORDS+FRAMES*FRAME_WORDS)*4;
  int32_t *sx=(int32_t*)(heap+5000000),*sy=sx+vertex_count,*sz=sy+vertex_count,*rny=sz+vertex_count;
  int32_t *depthbuf=(int32_t*)(heap+6000000);uint8_t *frame_pixels=heap+6100000;
  uint32_t visible_total=0,pick_hits=0,transform_hash=2166136261u,draw_hash=2166136261u,rasterized=0;
  for(int frame=0;frame<FRAMES;frame++){
    int32_t co=anim[frame*3],si=anim[frame*3+1],bounce=anim[frame*3+2];
    int32_t minx=2147483647,miny=2147483647,maxx=(-2147483647-1),maxy=(-2147483647-1);
    for(uint32_t i=0;i<vertex_count;i++){
      uint32_t p=i*3;int32_t x=-pos[p],y=-pos[p+1]+bounce,z=pos[p+2];
      int32_t rx=div_trunc((int64_t)x*co-(int64_t)z*si,ROT_SCALE);
      int32_t rz=div_trunc((int64_t)x*si+(int64_t)z*co,ROT_SCALE);int32_t depth=2000000+rz;
      sx[i]=48+div_trunc((int64_t)rx*1000,depth);sy[i]=58-div_trunc((int64_t)y*1000,depth);sz[i]=depth;rny[i]=-norm[p+1];
      if(sx[i]<minx)minx=sx[i];if(sy[i]<miny)miny=sy[i];if(sx[i]>maxx)maxx=sx[i];if(sy[i]>maxy)maxy=sy[i];
      transform_hash=hash_word(transform_hash,sx[i]);transform_hash=hash_word(transform_hash,sy[i]);transform_hash=hash_word(transform_hash,depth);
    }
    uint32_t visible=0;int32_t picked=-1,best_depth=2147483647;int pick=is_pick(frame);
    int32_t pickx=48+(((frame/50)%3)-1)*4,picky=70+((frame/50)%2)*6;
    for(uint32_t tri=0;tri<index_count/3;tri++){
      uint32_t a=ind[tri*3],b=ind[tri*3+1],c=ind[tri*3+2];int64_t area=edge(sx[a],sy[a],sx[b],sy[b],sx[c],sy[c]);if(area>=0)continue;
      visible++;draw_hash=hash_word(draw_hash,(int32_t)tri);draw_hash=hash_word(draw_hash,frame);
      if(pick){int64_t e0=edge(sx[a],sy[a],sx[b],sy[b],pickx,picky),e1=edge(sx[b],sy[b],sx[c],sy[c],pickx,picky),e2=edge(sx[c],sy[c],sx[a],sy[a],pickx,picky);
        if(e0<=0&&e1<=0&&e2<=0){int32_t d=(sz[a]+sz[b]+sz[c])/3;if(d<best_depth){best_depth=d;picked=(int32_t)tri;}}}
    }
    if(pick&&picked>=0)pick_hits++;visible_total+=visible;uint32_t fo=frame*FRAME_WORDS;
    frame_words[fo]=minx;frame_words[fo+1]=miny;frame_words[fo+2]=maxx;frame_words[fo+3]=maxy;frame_words[fo+4]=(int32_t)visible;frame_words[fo+5]=picked;frame_words[fo+6]=(int32_t)transform_hash;frame_words[fo+7]=(int32_t)draw_hash;
    for(int i=0;i<WIDTH*HEIGHT;i++){depthbuf[i]=2147483647;uint32_t po=(uint32_t)i*4;frame_pixels[po]=0;frame_pixels[po+1]=0;frame_pixels[po+2]=0;frame_pixels[po+3]=0;}
    for(uint32_t tri=0;tri<index_count/3;tri++){uint32_t a=ind[tri*3],b=ind[tri*3+1],c=ind[tri*3+2];int64_t area=edge(sx[a],sy[a],sx[b],sy[b],sx[c],sy[c]);if(area>=0)continue;
      int32_t lox=min3(sx[a],sx[b],sx[c]),hix=max3(sx[a],sx[b],sx[c]),loy=min3(sy[a],sy[b],sy[c]),hiy=max3(sy[a],sy[b],sy[c]);if(lox<0)lox=0;if(hix>95)hix=95;if(loy<0)loy=0;if(hiy>95)hiy=95;
      int32_t depth=(sz[a]+sz[b]+sz[c])/3,u=div_trunc((int64_t)uv[a*2]*63,65535),v=div_trunc((int64_t)uv[a*2+1]*63,65535);if(u<0)u=0;if(u>63)u=63;if(v<0)v=0;if(v>63)v=63;uint32_t ti=(v*64+u)*4;
      int32_t light=128+div_trunc((int64_t)rny[a]*127,NORMAL_SCALE);if(light<64)light=64;if(light>255)light=255;
      for(int32_t y=loy;y<=hiy;y++)for(int32_t x=lox;x<=hix;x++){int64_t e0=edge(sx[a],sy[a],sx[b],sy[b],x,y),e1=edge(sx[b],sy[b],sx[c],sy[c],x,y),e2=edge(sx[c],sy[c],sx[a],sy[a],x,y);uint32_t pi=(uint32_t)(y*WIDTH+x);
        if(e0<=0&&e1<=0&&e2<=0&&depth<depthbuf[pi]){depthbuf[pi]=depth;uint32_t po=pi*4;frame_pixels[po]=(uint8_t)((texture[ti]*light)/255);frame_pixels[po+1]=(uint8_t)((texture[ti+1]*light)/255);frame_pixels[po+2]=(uint8_t)((texture[ti+2]*light)/255);frame_pixels[po+3]=255;rasterized++;}}
    }
    uint8_t *pixels=pixel_base+frame*WIDTH*HEIGHT*4;for(int i=0;i<WIDTH*HEIGHT*4;i++)pixels[i]=frame_pixels[i];
  }
  words[0]=0x474c5446;words[1]=vertex_count;words[2]=index_count;words[3]=FRAMES;words[4]=visible_total;words[5]=pick_hits;words[6]=transform_hash;words[7]=draw_hash;words[8]=rasterized;
  words[9]=vertex_count*FRAMES;words[10]=(index_count/3)*FRAMES*2;words[11]=FRAMES;words[12]=RETAINED_FRAMES;words[13]=12;words[14]=decoder_boundaries+4;words[15]=decoder_allocations+5;
  words[16]=vertex_count*8*4+index_count*4+64*64*4;words[17]=HEADER_WORDS*4+FRAMES*FRAME_WORDS*4+RETAINED_FRAMES*WIDTH*HEIGHT*4;words[18]=1;words[19]=1;
  words[20]=decoder_allocations;words[21]=decoder_api_calls;words[22]=decoder_boundaries;words[23]=4;words[24]=5;words[25]=FRAMES;words[26]=FRAMES;words[27]=0;
  return 0;
}
