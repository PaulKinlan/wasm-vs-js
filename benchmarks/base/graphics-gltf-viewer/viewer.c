#include <stdint.h>
#define FRAMES 600
#define WIDTH 96
#define HEIGHT 96
#define CHECKPOINTS 6
#define HEADER_WORDS 24
#define FRAME_WORDS 8
#define ROT_SCALE 1048576
#define NORMAL_SCALE 32767

static uint8_t heap[16777216];
uint32_t heap_ptr(void) { return (uint32_t)(uintptr_t)heap; }
uint32_t output_ptr(void) { return (uint32_t)(uintptr_t)(heap + 8000000); }
static int32_t div_trunc(int64_t v, int32_t d) { return (int32_t)(v / d); }
static uint32_t hash_word(uint32_t h, int32_t v) { return (h ^ (uint32_t)v) * 16777619u; }
static int64_t edge(int32_t ax,int32_t ay,int32_t bx,int32_t by,int32_t px,int32_t py) {
  return (int64_t)(px-ax)*(by-ay)-(int64_t)(py-ay)*(bx-ax);
}
static int checkpoint_index(int f) {
  const int values[6]={0,119,239,359,479,599};
  for(int i=0;i<6;i++) if(values[i]==f) return i;
  return -1;
}
static int is_pick(int f) { return f>=25 && f<=575 && ((f-25)%50)==0; }
static int32_t min3(int32_t a,int32_t b,int32_t c){int32_t m=a<b?a:b;return m<c?m:c;}
static int32_t max3(int32_t a,int32_t b,int32_t c){int32_t m=a>b?a:b;return m>c?m:c;}

int validate_gltf(uint32_t off,uint32_t len) {
  const char *s=(const char*)(heap+off);
  const char *need[]={"\"version\": \"2.0\"","\"KHR_draco_mesh_compression\"","\"POSITION\": 3","\"count\": 2046","\"count\": 406","\"alphaMode\": \"OPAQUE\""};
  for(int n=0;n<6;n++){
    const char *q=need[n]; int found=0;
    for(uint32_t i=0;i<len;i++){uint32_t j=0;while(q[j]&&i+j<len&&s[i+j]==q[j])j++;if(!q[j]){found=1;break;}}
    if(!found)return -(n+1);
  }
  return 0;
}

int run(uint32_t pos_off,uint32_t norm_off,uint32_t uv_off,uint32_t index_off,uint32_t texture_off,uint32_t anim_off,uint32_t vertex_count,uint32_t index_count){
  int32_t *pos=(int32_t*)(heap+pos_off),*norm=(int32_t*)(heap+norm_off),*uv=(int32_t*)(heap+uv_off);
  uint32_t *ind=(uint32_t*)(heap+index_off); uint8_t *texture=heap+texture_off; int32_t *anim=(int32_t*)(heap+anim_off);
  uint8_t *out=heap+8000000; uint32_t *words=(uint32_t*)out; int32_t *frame_words=(int32_t*)(out+HEADER_WORDS*4);
  uint8_t *pixel_base=out+(HEADER_WORDS+FRAMES*FRAME_WORDS)*4;
  int32_t *sx=(int32_t*)(heap+5000000),*sy=sx+vertex_count,*sz=sy+vertex_count,*rny=sz+vertex_count;
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
    int32_t pickx=48+(((frame/50)%3)-1)*4,picky=48+((frame/50)%2)*5;
    for(uint32_t tri=0;tri<index_count/3;tri++){
      uint32_t a=ind[tri*3],b=ind[tri*3+1],c=ind[tri*3+2];int64_t area=edge(sx[a],sy[a],sx[b],sy[b],sx[c],sy[c]);if(area>=0)continue;
      visible++;draw_hash=hash_word(draw_hash,(int32_t)tri);draw_hash=hash_word(draw_hash,frame);
      if(pick){int64_t e0=edge(sx[a],sy[a],sx[b],sy[b],pickx,picky),e1=edge(sx[b],sy[b],sx[c],sy[c],pickx,picky),e2=edge(sx[c],sy[c],sx[a],sy[a],pickx,picky);
        if(e0<=0&&e1<=0&&e2<=0){int32_t d=(sz[a]+sz[b]+sz[c])/3;if(d<best_depth){best_depth=d;picked=(int32_t)tri;}}}
    }
    if(pick&&picked>=0)pick_hits++;visible_total+=visible;uint32_t fo=frame*FRAME_WORDS;
    frame_words[fo]=minx;frame_words[fo+1]=miny;frame_words[fo+2]=maxx;frame_words[fo+3]=maxy;frame_words[fo+4]=(int32_t)visible;frame_words[fo+5]=picked;frame_words[fo+6]=(int32_t)transform_hash;frame_words[fo+7]=(int32_t)draw_hash;
    int ci=checkpoint_index(frame);if(ci>=0){uint8_t *pixels=pixel_base+ci*WIDTH*HEIGHT*4;int32_t *depthbuf=(int32_t*)(heap+6000000);for(int i=0;i<WIDTH*HEIGHT;i++)depthbuf[i]=2147483647;
      for(uint32_t tri=0;tri<index_count/3;tri++){uint32_t a=ind[tri*3],b=ind[tri*3+1],c=ind[tri*3+2];int64_t area=edge(sx[a],sy[a],sx[b],sy[b],sx[c],sy[c]);if(area>=0)continue;
        int32_t lox=min3(sx[a],sx[b],sx[c]),hix=max3(sx[a],sx[b],sx[c]),loy=min3(sy[a],sy[b],sy[c]),hiy=max3(sy[a],sy[b],sy[c]);if(lox<0)lox=0;if(hix>95)hix=95;if(loy<0)loy=0;if(hiy>95)hiy=95;
        int32_t depth=(sz[a]+sz[b]+sz[c])/3,u=div_trunc((int64_t)uv[a*2]*63,65535),v=div_trunc((int64_t)uv[a*2+1]*63,65535);if(u<0)u=0;if(u>63)u=63;if(v<0)v=0;if(v>63)v=63;uint32_t ti=(v*64+u)*4;
        int32_t light=128+div_trunc((int64_t)rny[a]*127,NORMAL_SCALE);if(light<64)light=64;if(light>255)light=255;
        for(int32_t y=loy;y<=hiy;y++)for(int32_t x=lox;x<=hix;x++){int64_t e0=edge(sx[a],sy[a],sx[b],sy[b],x,y),e1=edge(sx[b],sy[b],sx[c],sy[c],x,y),e2=edge(sx[c],sy[c],sx[a],sy[a],x,y);uint32_t pi=(uint32_t)(y*WIDTH+x);
          if(e0<=0&&e1<=0&&e2<=0&&depth<depthbuf[pi]){depthbuf[pi]=depth;uint32_t po=pi*4;pixels[po]=(uint8_t)((texture[ti]*light)/255);pixels[po+1]=(uint8_t)((texture[ti+1]*light)/255);pixels[po+2]=(uint8_t)((texture[ti+2]*light)/255);pixels[po+3]=255;rasterized++;}}
      }
    }
  }
  words[0]=0x474c5446;words[1]=vertex_count;words[2]=index_count;words[3]=FRAMES;words[4]=visible_total;words[5]=pick_hits;words[6]=transform_hash;words[7]=draw_hash;words[8]=rasterized;
  words[9]=vertex_count*FRAMES;words[10]=(index_count/3)*FRAMES;words[11]=FRAMES;words[12]=CHECKPOINTS;words[13]=12;words[14]=1;words[15]=7;
  words[16]=vertex_count*8*4+index_count*4+64*64*4;words[17]=HEADER_WORDS*4+FRAMES*FRAME_WORDS*4+CHECKPOINTS*WIDTH*HEIGHT*4;words[18]=1;words[19]=1;
  return 0;
}
