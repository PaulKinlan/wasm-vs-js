#include <stdint.h>

#define ENTRY_COUNT 10000u
#define ARCHIVE_CAP 3000000u
#define LISTING_CAP 600000u
#define EXTRACT_CAP 8192u
#define TMP_CAP 256u
#define UTF8_FLAG 0x0800u
#define UNIX_MODE 0100644u

static uint8_t archive_bytes[ARCHIVE_CAP];
static uint8_t listing_bytes[LISTING_CAP];
static uint8_t extracted_bytes[EXTRACT_CAP];
static uint32_t local_offsets[ENTRY_COUNT];
static uint32_t crcs[ENTRY_COUNT];
static uint32_t compressed_sizes[ENTRY_COUNT];
static uint32_t plain_sizes[ENTRY_COUNT];
static uint16_t name_sizes[ENTRY_COUNT];
static uint32_t archive_len;
static uint32_t listing_len;
static uint32_t extracted_len;
static uint32_t counters[13];
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
static uint32_t deflate_fixed(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t cap){
  BitWriter w={out,cap,0,0,0,1};bw_bits(&w,1,1);bw_bits(&w,1,2);
  for(uint32_t i=0;i<n&&w.ok;i++){uint32_t c,b;fixed_code(in[i],&c,&b);bw_bits(&w,c,b);}
  uint32_t c,b;fixed_code(256,&c,&b);bw_bits(&w,c,b);if(w.bits&&w.ok)append8(out,cap,&w.at,w.acc);return w.ok?w.at:0;
}

typedef struct{const uint8_t*in;uint32_t n,at,acc,bits;int ok;}BitReader;
static uint32_t br_bits(BitReader*r,uint32_t width){while(r->bits<width){if(r->at>=r->n){r->ok=0;return 0;}r->acc|=(uint32_t)r->in[r->at++]<<r->bits;r->bits+=8;}uint32_t mask=(1u<<width)-1u;uint32_t v=r->acc&mask;r->acc>>=width;r->bits-=width;return v;}
static int decode_symbol(BitReader*r){uint32_t code=0;for(uint32_t width=1;width<=9;width++){code|=br_bits(r,1)<<(width-1);if(!r->ok)return -1;for(uint32_t s=0;s<=287;s++){uint32_t c,b;fixed_code(s,&c,&b);if(b==width&&c==code)return (int)s;}}return -1;}
static int inflate_fixed(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t expected){BitReader r={in,n,0,0,0,1};if(br_bits(&r,1)!=1||br_bits(&r,2)!=1)return 0;uint32_t at=0;for(;;){int s=decode_symbol(&r);if(s==256)break;if(s<0||s>255||at>=expected)return 0;out[at++]=(uint8_t)s;}return r.ok&&at==expected;}

static uint32_t crc32_bytes(const uint8_t*in,uint32_t n){uint32_t crc=0xffffffffu;for(uint32_t i=0;i<n;i++){crc^=in[i];for(uint32_t b=0;b<8;b++)crc=(crc&1u)?(0xedb88320u^(crc>>1)):(crc>>1);}return crc^0xffffffffu;}

static uint32_t path_for(uint32_t index,uint8_t*out){uint32_t at=0;if(index%997u==0){out[at++]='c';out[at++]='a';out[at++]='f';out[at++]=0xc3;out[at++]=0xa9;}else if(index%991u==0){out[at++]=0xe6;out[at++]=0x9d;out[at++]=0xb1;out[at++]=0xe4;out[at++]=0xba;out[at++]=0xac;}else{out[at++]='s';out[at++]='r';out[at++]='c';}out[at++]='/';uint32_t group=index/100u;out[at++]=(uint8_t)('0'+(group/100u)%10u);out[at++]=(uint8_t)('0'+(group/10u)%10u);out[at++]=(uint8_t)('0'+group%10u);out[at++]='/';out[at++]='f';out[at++]='i';out[at++]='l';out[at++]='e';out[at++]='-';out[at++]=(uint8_t)('0'+(index/10000u)%10u);out[at++]=(uint8_t)('0'+(index/1000u)%10u);out[at++]=(uint8_t)('0'+(index/100u)%10u);out[at++]=(uint8_t)('0'+(index/10u)%10u);out[at++]=(uint8_t)('0'+index%10u);out[at++]='.';out[at++]='t';out[at++]='x';out[at++]='t';return at;}
static uint32_t content_for(uint32_t index,uint8_t*out){uint32_t n=32u+(index%33u);uint32_t state=0x9e3779b9u^index;for(uint32_t i=0;i<n;i++){state^=state<<13;state^=state>>17;state^=state<<5;out[i]=(uint8_t)((state>>24)^(i&7u)^(index&255u));}return n;}
static int equal_bytes(const uint8_t*a,const uint8_t*b,uint32_t n){for(uint32_t i=0;i<n;i++)if(a[i]!=b[i])return 0;return 1;}
static int selected_slot(uint32_t index){for(uint32_t i=0;i<10;i++)if(selected[i]==index)return (int)i;return -1;}

static int build_zip(void){uint8_t name[64],plain[96],compressed[TMP_CAP];uint32_t at=0,input_total=0;
  for(uint32_t i=0;i<ENTRY_COUNT;i++){uint32_t nl=path_for(i,name),pl=content_for(i,plain),cl=deflate_fixed(plain,pl,compressed,TMP_CAP),crc=crc32_bytes(plain,pl);if(!cl)return 0;local_offsets[i]=at;crcs[i]=crc;compressed_sizes[i]=cl;plain_sizes[i]=pl;name_sizes[i]=(uint16_t)nl;
    if(!append32(archive_bytes,ARCHIVE_CAP,&at,0x04034b50)||!append16(archive_bytes,ARCHIVE_CAP,&at,20)||!append16(archive_bytes,ARCHIVE_CAP,&at,UTF8_FLAG)||!append16(archive_bytes,ARCHIVE_CAP,&at,8)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0x21)||!append32(archive_bytes,ARCHIVE_CAP,&at,crc)||!append32(archive_bytes,ARCHIVE_CAP,&at,cl)||!append32(archive_bytes,ARCHIVE_CAP,&at,pl)||!append16(archive_bytes,ARCHIVE_CAP,&at,nl)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append_bytes(archive_bytes,ARCHIVE_CAP,&at,name,nl)||!append_bytes(archive_bytes,ARCHIVE_CAP,&at,compressed,cl))return 0;input_total+=pl;}
  uint32_t central=at;
  for(uint32_t i=0;i<ENTRY_COUNT;i++){uint32_t nl=path_for(i,name);if(!append32(archive_bytes,ARCHIVE_CAP,&at,0x02014b50)||!append16(archive_bytes,ARCHIVE_CAP,&at,0x0314)||!append16(archive_bytes,ARCHIVE_CAP,&at,20)||!append16(archive_bytes,ARCHIVE_CAP,&at,UTF8_FLAG)||!append16(archive_bytes,ARCHIVE_CAP,&at,8)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0x21)||!append32(archive_bytes,ARCHIVE_CAP,&at,crcs[i])||!append32(archive_bytes,ARCHIVE_CAP,&at,compressed_sizes[i])||!append32(archive_bytes,ARCHIVE_CAP,&at,plain_sizes[i])||!append16(archive_bytes,ARCHIVE_CAP,&at,nl)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append32(archive_bytes,ARCHIVE_CAP,&at,UNIX_MODE<<16)||!append32(archive_bytes,ARCHIVE_CAP,&at,local_offsets[i])||!append_bytes(archive_bytes,ARCHIVE_CAP,&at,name,nl))return 0;}
  uint32_t central_size=at-central;if(at>=0xffffffffu||central>=0xffffffffu)return 0;if(!append32(archive_bytes,ARCHIVE_CAP,&at,0x06054b50)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,0)||!append16(archive_bytes,ARCHIVE_CAP,&at,ENTRY_COUNT)||!append16(archive_bytes,ARCHIVE_CAP,&at,ENTRY_COUNT)||!append32(archive_bytes,ARCHIVE_CAP,&at,central_size)||!append32(archive_bytes,ARCHIVE_CAP,&at,central)||!append16(archive_bytes,ARCHIVE_CAP,&at,0))return 0;
  archive_len=at;counters[0]=ENTRY_COUNT;counters[1]=input_total;counters[2]=input_total;counters[3]=input_total;counters[4]=ENTRY_COUNT;counters[5]=ENTRY_COUNT;counters[6]=ENTRY_COUNT;counters[7]=0;return 1;}

static int unsafe_path(const uint8_t*n,uint32_t l){if(!l||n[0]=='/')return 1;uint32_t part=0;for(uint32_t i=0;i<=l;i++){uint8_t c=i<l?n[i]:'/';if(c=='\\')return 1;if(c=='/'){if(part==0)return 1;if(part==1&&n[i-1]=='.')return 1;if(part==2&&n[i-1]=='.'&&n[i-2]=='.')return 1;part=0;}else part++;}return 0;}
static int inspect_zip(const uint8_t*z,uint32_t n,int write_outputs){if(n<22)return 0;uint32_t e=n-22;while(get32(z+e)!=0x06054b50u){if(e==0||n-e>65557u)return 0;e--;}
  if(get16(z+e+4)||get16(z+e+6))return 0;uint32_t count=get16(z+e+8);if(count!=ENTRY_COUNT||get16(z+e+10)!=count)return 0;uint32_t csize=get32(z+e+12),coff=get32(z+e+16);if(csize==0xffffffffu||coff==0xffffffffu||coff+csize!=e)return 0;uint32_t cur=coff,lat=0,eat=0,exbytes=0;uint8_t expected_name[64],expected_plain[96],plain[96];
  for(uint32_t i=0;i<count;i++){if(cur+46>e||get32(z+cur)!=0x02014b50u)return 0;uint32_t flags=get16(z+cur+8),method=get16(z+cur+10),crc=get32(z+cur+16),cs=get32(z+cur+20),ps=get32(z+cur+24),nl=get16(z+cur+28),xl=get16(z+cur+30),comment=get16(z+cur+32),external=get32(z+cur+38),lo=get32(z+cur+42);if(flags!=UTF8_FLAG||method!=8||xl||comment||external!=(UNIX_MODE<<16)||cur+46+nl>e||unsafe_path(z+cur+46,nl))return 0;uint32_t enl=path_for(i,expected_name);if(nl!=enl||!equal_bytes(z+cur+46,expected_name,nl))return 0;if(write_outputs){if(!append16(listing_bytes,LISTING_CAP,&lat,nl)||!append_bytes(listing_bytes,LISTING_CAP,&lat,z+cur+46,nl)||!append32(listing_bytes,LISTING_CAP,&lat,ps)||!append32(listing_bytes,LISTING_CAP,&lat,cs)||!append32(listing_bytes,LISTING_CAP,&lat,crc))return 0;}
    if(lo+30>coff||get32(z+lo)!=0x04034b50u||get16(z+lo+6)!=flags||get16(z+lo+8)!=method||get32(z+lo+14)!=crc||get32(z+lo+18)!=cs||get32(z+lo+22)!=ps||get16(z+lo+26)!=nl||get16(z+lo+28)!=0)return 0;uint32_t data=lo+30+nl;if(data+cs>coff)return 0;if(selected_slot(i)>=0){if(ps>96||!inflate_fixed(z+data,cs,plain,ps)||crc32_bytes(plain,ps)!=crc)return 0;uint32_t expected_len=content_for(i,expected_plain);if(expected_len!=ps||!equal_bytes(plain,expected_plain,ps))return 0;if(write_outputs){if(!append32(extracted_bytes,EXTRACT_CAP,&eat,i)||!append32(extracted_bytes,EXTRACT_CAP,&eat,ps)||!append_bytes(extracted_bytes,EXTRACT_CAP,&eat,plain,ps))return 0;}exbytes+=ps;}cur+=46+nl;}
  if(cur!=e)return 0;if(write_outputs){listing_len=lat;extracted_len=eat;counters[8]=count;counters[9]=10;counters[10]=exbytes;counters[11]=3;counters[12]=archive_len;}return 1;}

__attribute__((export_name("archive_run"))) int archive_run(void){for(uint32_t i=0;i<13;i++)counters[i]=0;archive_len=listing_len=extracted_len=0;if(!build_zip())return 1;if(!inspect_zip(archive_bytes,archive_len,1))return 2;return 0;}
__attribute__((export_name("archive_validate"))) int archive_validate(uint32_t len){return inspect_zip(archive_bytes,len,0);}
__attribute__((export_name("archive_ptr"))) uint32_t archive_ptr(void){return (uint32_t)(uintptr_t)archive_bytes;}
__attribute__((export_name("archive_length"))) uint32_t archive_length(void){return archive_len;}
__attribute__((export_name("listing_ptr"))) uint32_t listing_ptr(void){return (uint32_t)(uintptr_t)listing_bytes;}
__attribute__((export_name("listing_length"))) uint32_t listing_length(void){return listing_len;}
__attribute__((export_name("extracted_ptr"))) uint32_t extracted_ptr(void){return (uint32_t)(uintptr_t)extracted_bytes;}
__attribute__((export_name("extracted_length"))) uint32_t extracted_length(void){return extracted_len;}
__attribute__((export_name("counters_ptr"))) uint32_t counters_ptr(void){return (uint32_t)(uintptr_t)counters;}
