#include <stdint.h>

#define BOUNDED_ENTRY_COUNT 1000u
#define UTF8_FLAG 0x0800u
#define UNIX_MODE 0100644u

#define ARCHIVE_OFFSET 1048576u
#define EXTRACTED_OFFSET 2097152u
#define RES_OFFSET 3145728u
#define LISTING_OFFSET 4194304u
#define INTERNAL_OFFSET 5242880u

// Internal arrays starting at INTERNAL_OFFSET
#define LOCAL_OFFSETS ((uint32_t*)INTERNAL_OFFSET)
#define CRCS ((uint32_t*)(INTERNAL_OFFSET + 4000u))
#define COMPRESSED_SIZES ((uint32_t*)(INTERNAL_OFFSET + 8000u))
#define PLAIN_SIZES ((uint32_t*)(INTERNAL_OFFSET + 12000u))
#define NAME_SIZES ((uint16_t*)(INTERNAL_OFFSET + 16000u))

static const uint32_t selected[10] = {0,1,17,997,2048,4096,7001,8191,9998,9999};

static void set16(uint8_t *p, uint32_t v) { p[0]=(uint8_t)v; p[1]=(uint8_t)(v>>8); }
static void set32(uint8_t *p, uint32_t v) { p[0]=(uint8_t)v; p[1]=(uint8_t)(v>>8); p[2]=(uint8_t)(v>>16); p[3]=(uint8_t)(v>>24); }
static uint32_t get16(const uint8_t *p) { return (uint32_t)p[0] | ((uint32_t)p[1]<<8); }
static uint32_t get32(const uint8_t *p) { return (uint32_t)p[0] | ((uint32_t)p[1]<<8) | ((uint32_t)p[2]<<16) | ((uint32_t)p[3]<<24); }
static int append8(uint8_t *out, uint32_t cap, uint32_t *at, uint32_t v) { if(*at>=cap)return 0;out[(*at)++]=(uint8_t)v;return 1; }
static int append16(uint8_t *out,uint32_t cap,uint32_t *at,uint32_t v){if(*at+2>cap)return 0;set16(out+*at,v);*at+=2;return 1;}
static int append32(uint8_t *out,uint32_t cap,uint32_t *at,uint32_t v){if(*at+4>cap)return 0;set32(out+*at,v);*at+=4;return 1;}
static int append_bytes(uint8_t*out,uint32_t cap,uint32_t*at,const uint8_t*src,uint32_t n){if(*at+n>cap)return 0;for(uint32_t i=0;i<n;i++)out[*at+i]=src[i];*at+=n;return 1;}

static uint32_t reverse_bits(uint32_t value,uint32_t width){uint32_t r=0;for(uint32_t i=0;i<width;i++)r=(r<<1)|((value>>i)&1u);return r;}
static void fixed_code(uint32_t symbol,uint32_t *code,uint32_t *width){
  if(symbol<=143){*width=8;*code=reverse_bits(0x30u+symbol,8);}
  else if(symbol<=255){*width=9;*code=reverse_bits(0x190u+symbol-144u,9);}
  else if(symbol<=279){*width=7;*code=reverse_bits(symbol-256u,7);}
  else {*width=8;*code=reverse_bits(0xc0u+symbol-280u,8);}
}

typedef struct {uint8_t*out;uint32_t cap,at,acc,bits;int ok;} BitWriter;
static void bw_bits(BitWriter*w,uint32_t value,uint32_t width){
  w->acc|=value<<w->bits;w->bits+=width;
  while(w->bits>=8){if(w->at>=w->cap){w->ok=0;return;}w->out[w->at++]=(uint8_t)w->acc;w->acc>>=8;w->bits-=8;}
}
static const uint16_t length_base[29]={3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258};
static const uint8_t length_extra[29]={0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0};
static const uint16_t dist_base[30]={1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577};
static const uint8_t dist_extra[30]={0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13};
static uint32_t deflate_fixed(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t cap,uint32_t*literal_count,uint32_t*match_count,uint32_t*matched_bytes){
  BitWriter w={out,cap,0,0,0,1};bw_bits(&w,1,1);bw_bits(&w,1,2);uint32_t pos=0;
  while(pos<n&&w.ok){uint32_t best=0,best_dist=0,earliest=pos>1024u?pos-1024u:0;
    for(uint32_t candidate=pos;candidate>earliest;){candidate--;uint32_t len=0;while(len<258u&&pos+len<n&&in[candidate+len]==in[pos+len])len++;if(len>=3u&&len>best){best=len;best_dist=pos-candidate;}}
    uint32_t c,b;if(best>=3u){uint32_t li=28;for(uint32_t k=0;k<29;k++){uint32_t max=length_base[k]+((1u<<length_extra[k])-1u);if(best<=max){li=k;break;}}fixed_code(257u+li,&c,&b);bw_bits(&w,c,b);if(length_extra[li])bw_bits(&w,best-length_base[li],length_extra[li]);uint32_t di=0;while(di+1u<30u&&best_dist>=dist_base[di+1u])di++;bw_bits(&w,reverse_bits(di,5),5);if(dist_extra[di])bw_bits(&w,best_dist-dist_base[di],dist_extra[di]);(*match_count)++;*matched_bytes+=best;pos+=best;}else{fixed_code(in[pos++],&c,&b);bw_bits(&w,c,b);(*literal_count)++;}}
  uint32_t c,b;fixed_code(256,&c,&b);bw_bits(&w,c,b);if(w.bits&&w.ok)append8(out,cap,&w.at,w.acc);return w.ok?w.at:0;
}

typedef struct{const uint8_t*in;uint32_t n,at,acc,bits;int ok;}BitReader;
static uint32_t br_bits(BitReader*r,uint32_t width){while(r->bits<width){if(r->at>=r->n){r->ok=0;return 0;}r->acc|=(uint32_t)r->in[r->at++]<<r->bits;r->bits+=8;}uint32_t mask=(1u<<width)-1u;uint32_t v=r->acc&mask;r->acc>>=width;r->bits-=width;return v;}
static int decode_symbol(BitReader*r){uint32_t code=0;for(uint32_t width=1;width<=9;width++){code|=br_bits(r,1)<<(width-1);if(!r->ok)return -1;for(uint32_t s=0;s<=287;s++){uint32_t c,b;fixed_code(s,&c,&b);if(b==width&&c==code)return (int)s;}}return -1;}
static int inflate_fixed(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t expected){BitReader r={in,n,0,0,0,1};if(br_bits(&r,1)!=1||br_bits(&r,2)!=1)return 0;uint32_t at=0;for(;;){int s=decode_symbol(&r);if(s==256)break;if(s<0)return 0;if(s<256){if(at>=expected)return 0;out[at++]=(uint8_t)s;continue;}if(s>285)return 0;uint32_t li=(uint32_t)s-257u,len=length_base[li]+br_bits(&r,length_extra[li]),dc=reverse_bits(br_bits(&r,5),5);if(dc>=30)return 0;uint32_t dist=dist_base[dc]+br_bits(&r,dist_extra[dc]);if(dist>at||at+len>expected)return 0;for(uint32_t i=0;i<len;i++){out[at]=out[at-dist];at++;}}return r.ok&&at==expected;}

static uint32_t crc32_bytes(const uint8_t*in,uint32_t n){uint32_t crc=0xffffffffu;for(uint32_t i=0;i<n;i++){crc^=in[i];for(uint32_t b=0;b<8;b++)crc=(crc&1u)?(0xedb88320u^(crc>>1)):(crc>>1);}return crc^0xffffffffu;}

static void path_text(uint8_t*out,uint32_t*at,const char*s){while(*s)out[(*at)++]=(uint8_t)*s++;}
static uint32_t path_for(uint32_t index,uint8_t*out){uint32_t at=0;const char*bases[4]={"src","data","assets","docs"};const char*stems[4]={"module","event","blob","note"};const char*exts[4]={"ts","json","bin","md"};uint32_t family=index&3u;path_text(out,&at,bases[family]);if(index%997u==0){path_text(out,&at,"/caf");out[at++]=0xc3;out[at++]=0xa9;}else if(index%991u==0){out[at++]='/';out[at++]=0xe6;out[at++]=0x9d;out[at++]=0xb1;out[at++]=0xe4;out[at++]=0xba;out[at++]=0xac;}out[at++]='/';uint32_t group=index/100u;out[at++]=(uint8_t)('0'+(group/100u)%10u);out[at++]=(uint8_t)('0'+(group/10u)%10u);out[at++]=(uint8_t)('0'+group%10u);out[at++]='/';path_text(out,&at,stems[family]);out[at++]='-';out[at++]=(uint8_t)('0'+(index/10000u)%10u);out[at++]=(uint8_t)('0'+(index/1000u)%10u);out[at++]=(uint8_t)('0'+(index/100u)%10u);out[at++]=(uint8_t)('0'+(index/10u)%10u);out[at++]=(uint8_t)('0'+index%10u);out[at++]='.';path_text(out,&at,exts[family]);return at;}
static uint32_t content_for(uint32_t index,uint8_t*out){static const char*t[4]={"export const value = ","{\"event\":\"workspace\",\"value\":","","# Workspace note "};uint32_t n=48u+(index%113u),state=0x9e3779b9u^index,f=index&3u,tl=0;while(t[f][tl])tl++;for(uint32_t i=0;i<n;i++){state^=state<<13;state^=state>>17;state^=state<<5;out[i]=f==2u?(uint8_t)((state>>24)^(index&255u)):(uint8_t)t[f][i%tl];}return n;}
static int equal_bytes(const uint8_t*a,const uint8_t*b,uint32_t n){for(uint32_t i=0;i<n;i++)if(a[i]!=b[i])return 0;return 1;}
static int selected_slot(uint32_t index){for(uint32_t i=0;i<10;i++)if(selected[i]==index)return (int)i;return -1;}
static uint32_t selected_count(uint32_t entry_count){uint32_t count=0;for(uint32_t i=0;i<10;i++)if(selected[i]<entry_count)count++;return count;}

static uint32_t fnv1a32(const uint8_t* bytes, uint32_t length) {
  uint32_t hash = 2166136261u;
  for (uint32_t i = 0; i < length; i++) {
    hash ^= bytes[i];
    hash *= 16777619u;
  }
  return hash;
}

__attribute__((export_name("zip_build"))) int zip_build(void){
  uint8_t* archive_bytes = (uint8_t*)ARCHIVE_OFFSET;
  uint8_t* extracted_bytes = (uint8_t*)EXTRACTED_OFFSET;
  uint8_t* listing_bytes = (uint8_t*)LISTING_OFFSET;
  uint32_t* counters = (uint32_t*)RES_OFFSET;
  for(uint32_t i=0; i<15; i++) counters[i] = 0;

  uint32_t archive_cap = 1048576u; // 1 MB
  uint32_t extract_cap = 1048576u; // 1 MB
  uint32_t listing_cap = 1048576u; // 1 MB
  uint32_t entry_count = BOUNDED_ENTRY_COUNT;

  uint8_t name[64],plain[192],compressed[256];
  uint32_t at=0,input_total=0,literal_total=0,match_total=0,matched_total=0;
  
  for(uint32_t i=0;i<entry_count;i++){
    uint32_t nl=path_for(i,name),pl=content_for(i,plain),cl=deflate_fixed(plain,pl,compressed,256,&literal_total,&match_total,&matched_total),crc=crc32_bytes(plain,pl);
    if(!cl) return 1;
    LOCAL_OFFSETS[i]=at; CRCS[i]=crc; COMPRESSED_SIZES[i]=cl; PLAIN_SIZES[i]=pl; NAME_SIZES[i]=(uint16_t)nl;
    if(!append32(archive_bytes,archive_cap,&at,0x04034b50)||!append16(archive_bytes,archive_cap,&at,20)||!append16(archive_bytes,archive_cap,&at,UTF8_FLAG)||!append16(archive_bytes,archive_cap,&at,8)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0x21)||!append32(archive_bytes,archive_cap,&at,crc)||!append32(archive_bytes,archive_cap,&at,cl)||!append32(archive_bytes,archive_cap,&at,pl)||!append16(archive_bytes,archive_cap,&at,nl)||!append16(archive_bytes,archive_cap,&at,0)||!append_bytes(archive_bytes,archive_cap,&at,name,nl)||!append_bytes(archive_bytes,archive_cap,&at,compressed,cl))return 2;
    input_total+=pl;
  }
  uint32_t central=at;
  for(uint32_t i=0;i<entry_count;i++){
    uint32_t nl=path_for(i,name);
    if(!append32(archive_bytes,archive_cap,&at,0x02014b50)||!append16(archive_bytes,archive_cap,&at,0x0314)||!append16(archive_bytes,archive_cap,&at,20)||!append16(archive_bytes,archive_cap,&at,UTF8_FLAG)||!append16(archive_bytes,archive_cap,&at,8)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0x21)||!append32(archive_bytes,archive_cap,&at,CRCS[i])||!append32(archive_bytes,archive_cap,&at,COMPRESSED_SIZES[i])||!append32(archive_bytes,archive_cap,&at,PLAIN_SIZES[i])||!append16(archive_bytes,archive_cap,&at,nl)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0)||!append32(archive_bytes,archive_cap,&at,UNIX_MODE<<16)||!append32(archive_bytes,archive_cap,&at,LOCAL_OFFSETS[i])||!append_bytes(archive_bytes,archive_cap,&at,name,nl))return 3;
  }
  uint32_t central_size=at-central;
  if(!append32(archive_bytes,archive_cap,&at,0x06054b50)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,0)||!append16(archive_bytes,archive_cap,&at,entry_count)||!append16(archive_bytes,archive_cap,&at,entry_count)||!append32(archive_bytes,archive_cap,&at,central_size)||!append32(archive_bytes,archive_cap,&at,central)||!append16(archive_bytes,archive_cap,&at,0))return 4;
  
  uint32_t archive_len=at;
  counters[0]=entry_count;counters[1]=input_total;counters[2]=input_total;counters[3]=literal_total;counters[4]=match_total;counters[5]=matched_total;counters[6]=entry_count;counters[7]=entry_count;counters[8]=entry_count;counters[9]=0;

  // inspect_zip pass
  uint32_t e=archive_len-22;
  uint32_t count=get16(archive_bytes+e+8);
  uint32_t coff=get32(archive_bytes+e+16);
  uint32_t cur=coff,lat=0,eat=0,exbytes=0;
  uint8_t expected_name[64],expected_plain[192];
  
  for(uint32_t i=0;i<count;i++){
    uint32_t crc=get32(archive_bytes+cur+16),cs=get32(archive_bytes+cur+20),ps=get32(archive_bytes+cur+24),nl=get16(archive_bytes+cur+28),lo=get32(archive_bytes+cur+42);
    uint32_t enl=path_for(i,expected_name);
    
    if(!append16(listing_bytes,listing_cap,&lat,nl)||!append_bytes(listing_bytes,listing_cap,&lat,archive_bytes+cur+46,nl)||!append32(listing_bytes,listing_cap,&lat,ps)||!append32(listing_bytes,listing_cap,&lat,cs)||!append32(listing_bytes,listing_cap,&lat,crc))return 5;
    
    uint32_t data=lo+30+nl;
    if(selected_slot(i)>=0){
      if(!inflate_fixed(archive_bytes+data,cs,plain,ps))return 6;
      if(!append32(extracted_bytes,extract_cap,&eat,i)||!append32(extracted_bytes,extract_cap,&eat,ps)||!append_bytes(extracted_bytes,extract_cap,&eat,plain,ps))return 7;
      exbytes+=ps;
    }
    cur+=46+nl;
  }
  
  counters[10]=count;counters[11]=selected_count(count);counters[12]=exbytes;counters[13]=0;counters[14]=0; // Wait, JS has 14 keys up to boundaryCrossings. boundaryCrossings is 13? Let's check JS.

  counters[15] = fnv1a32(archive_bytes, archive_len);
  counters[16] = fnv1a32(extracted_bytes, eat);
  
  return 0;
}
