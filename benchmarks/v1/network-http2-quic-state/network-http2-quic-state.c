#include <stdint.h>
#include <stddef.h>

enum { SCHEMA=0, RECORDS=1, BYTES=2, H2_FRAMES=3, H2_SETTINGS=4, H2_HEADERS=5,
 H2_CONT=6, H2_DATA=7, H2_WINDOW_UPDATE=8, H2_RST=9, HPACK_STATIC=10,
 HPACK_INSERTS=11, HPACK_HITS=12, HPACK_BYTES=13, H2_OPEN=14, H2_CLOSED=15,
 H2_DATA_BYTES=16, H2_WINDOW=17, QUIC_FRAMES=18, QUIC_STREAM=19, QUIC_ACK=20,
 QUIC_MAX_DATA=21, QUIC_RESET=22, QUIC_CLOSE=23, QPACK_CAP=24, QPACK_INSERTS=25,
 QPACK_DUPS=26, QPACK_BYTES=27, QUIC_STREAM_BYTES=28, QUIC_MAX_VALUE=29,
 EVENTS=30, ERRORS=31, EVENT_BASE=32, STATE_WORDS=64 };

static void event(uint32_t *o, uint32_t code) { uint32_t i=o[EVENTS]++; if(i<32)o[EVENT_BASE+i]=code; }
static void fail(uint32_t *o,uint32_t code){o[ERRORS]++;event(o,0x8000u|code);}
static uint32_t u24(const uint8_t*b,uint32_t p){return ((uint32_t)b[p]<<16)|((uint32_t)b[p+1]<<8)|b[p+2];}
static uint32_t u32be(const uint8_t*b,uint32_t p){return ((uint32_t)b[p]<<24)|((uint32_t)b[p+1]<<16)|((uint32_t)b[p+2]<<8)|b[p+3];}
static int prefixed(const uint8_t*b,uint32_t n,uint32_t*p,uint32_t prefix,uint32_t*v){
 if(*p>=n)return 0;uint32_t mask=(1u<<prefix)-1u,val=b[*p]&mask;(*p)++;if(val<mask){*v=val;return 1;}
 uint32_t shift=0;while(*p<n&&shift<=28){uint8_t x=b[(*p)++];val+=(uint32_t)(x&127u)<<shift;if(!(x&128u)){*v=val;return 1;}shift+=7;}return 0;
}
static int qvar(const uint8_t*b,uint32_t n,uint32_t*p,uint32_t*v){
 if(*p>=n)return 0;uint8_t f=b[*p];uint32_t count=1u<<(f>>6);if(count>4||*p+count>n)return 0;
 uint32_t val=f&63u;(*p)++;for(uint32_t i=1;i<count;i++)val=val*256u+b[(*p)++];*v=val;return 1;
}
static void parse_hpack(const uint8_t*b,uint32_t n,uint32_t*o){
 uint32_t p=0;while(p<n){uint8_t first=b[p];if(first&128u){uint32_t idx;if(!prefixed(b,n,&p,7,&idx)||idx==0){fail(o,11);return;}
 if(idx<=61)o[HPACK_STATIC]++;else if(idx<=61+o[HPACK_INSERTS])o[HPACK_HITS]++;else fail(o,12);event(o,0x1100u|(idx&255u));continue;}
 if(first&64u){uint32_t ni;if(!prefixed(b,n,&p,6,&ni)){fail(o,13);return;}uint32_t nl=0;
 if(ni==0){if(!prefixed(b,n,&p,7,&nl)){fail(o,14);return;}if(p+nl>n){fail(o,15);return;}p+=nl;}else if(ni<=61)o[HPACK_STATIC]++;
 uint32_t vl;if(!prefixed(b,n,&p,7,&vl)){fail(o,16);return;}if(p+vl>n){fail(o,17);return;}p+=vl;o[HPACK_INSERTS]++;o[HPACK_BYTES]+=nl+vl+32;event(o,0x1200u|(o[HPACK_INSERTS]&255u));continue;}
 fail(o,18);return;}
}
static void parse_h2(const uint8_t*b,uint32_t n,uint32_t*o,uint8_t*pending,uint32_t*pn){
 uint32_t p=0;while(p<n){if(p+9>n){fail(o,1);return;}uint32_t len=u24(b,p);uint8_t type=b[p+3],flags=b[p+4];uint32_t stream=u32be(b,p+5)&0x7fffffffu;p+=9;
 if(p+len>n){fail(o,2);return;}const uint8_t*payload=b+p;p+=len;o[H2_FRAMES]++;
 if(type==4){if(stream!=0||len%6)fail(o,3);else o[H2_SETTINGS]++;event(o,0x0104);}
 else if(type==1){if(stream==0)fail(o,4);o[H2_HEADERS]++;o[H2_OPEN]=stream;*pn=0;for(uint32_t i=0;i<len&&*pn<1024;i++)pending[(*pn)++]=payload[i];if(flags&4){parse_hpack(pending,*pn,o);*pn=0;}event(o,0x0101);}
 else if(type==9){o[H2_CONT]++;if(*pn==0||stream!=o[H2_OPEN])fail(o,5);for(uint32_t i=0;i<len&&*pn<1024;i++)pending[(*pn)++]=payload[i];if(flags&4){parse_hpack(pending,*pn,o);*pn=0;}event(o,0x0109);}
 else if(type==0){o[H2_DATA]++;o[H2_DATA_BYTES]+=len;if(flags&1)o[H2_CLOSED]=stream;event(o,0x0100);}
 else if(type==8){o[H2_WINDOW_UPDATE]++;if(len!=4)fail(o,6);else o[H2_WINDOW]+=u32be(payload,0)&0x7fffffffu;event(o,0x0108);}
 else if(type==3){o[H2_RST]++;if(len!=4||stream==0)fail(o,7);else o[H2_CLOSED]=stream;event(o,0x0103);}else fail(o,8);}
}
static void parse_qpack(const uint8_t*b,uint32_t n,uint32_t*o){
 uint32_t p=0;while(p<n){uint8_t first=b[p];if((first&0xe0u)==0x20u){uint32_t v;if(!prefixed(b,n,&p,5,&v)){fail(o,31);return;}o[QPACK_CAP]=v;event(o,0x2201);}
 else if((first&0xc0u)==0x40u){uint32_t nl;if(!prefixed(b,n,&p,5,&nl)){fail(o,32);return;}if(p+nl>n){fail(o,33);return;}p+=nl;uint32_t vl;if(!prefixed(b,n,&p,7,&vl)){fail(o,34);return;}if(p+vl>n){fail(o,35);return;}p+=vl;o[QPACK_INSERTS]++;o[QPACK_BYTES]+=nl+vl+32;event(o,0x2202);}
 else if((first&0xe0u)==0){uint32_t d;if(!prefixed(b,n,&p,5,&d)){fail(o,36);return;}if(d>=o[QPACK_INSERTS])fail(o,37);else{o[QPACK_DUPS]++;o[QPACK_BYTES]*=2;}event(o,0x2203);}else{fail(o,38);return;}}
}
static void parse_quic(const uint8_t*b,uint32_t n,uint32_t*o){
 uint32_t p=0;while(p<n){uint32_t type;if(!qvar(b,n,&p,&type)){fail(o,20);return;}o[QUIC_FRAMES]++;
 if((type&0xf8u)==8u){uint32_t stream;if(!qvar(b,n,&p,&stream)){fail(o,21);return;}if(type&4u){uint32_t off;if(!qvar(b,n,&p,&off)){fail(o,22);return;}}
 uint32_t len=n-p;if(type&2u){if(!qvar(b,n,&p,&len)){fail(o,23);return;}}if(p+len>n){fail(o,24);return;}const uint8_t*data=b+p;p+=len;o[QUIC_STREAM]++;o[QUIC_STREAM_BYTES]+=len;if(stream==2)parse_qpack(data,len,o);event(o,0x0208u|(type&7u));}
 else if(type==2){uint32_t v;for(int i=0;i<4;i++)if(!qvar(b,n,&p,&v)){fail(o,25);return;}o[QUIC_ACK]++;event(o,0x0202);}
 else if(type==0x10){uint32_t v;if(!qvar(b,n,&p,&v)){fail(o,26);return;}o[QUIC_MAX_DATA]++;o[QUIC_MAX_VALUE]=v;event(o,0x0210);}
 else if(type==4){uint32_t v;for(int i=0;i<3;i++)if(!qvar(b,n,&p,&v)){fail(o,27);return;}o[QUIC_RESET]++;event(o,0x0204);}
 else if(type==0x1c){uint32_t v;for(int i=0;i<2;i++)if(!qvar(b,n,&p,&v)){fail(o,28);return;}if(!qvar(b,n,&p,&v)){fail(o,29);return;}if(p+v>n){fail(o,30);return;}p+=v;o[QUIC_CLOSE]++;event(o,0x021c);}else{fail(o,39);return;}}
}
__attribute__((export_name("run_trace"))) uint32_t run_trace(uint32_t input_ptr,uint32_t input_len,uint32_t output_ptr){
 const uint8_t*b=(const uint8_t*)(uintptr_t)input_ptr;uint32_t*o=(uint32_t*)(uintptr_t)output_ptr;for(uint32_t i=0;i<STATE_WORDS;i++)o[i]=0;o[SCHEMA]=1;o[BYTES]=input_len;
 uint8_t pending[1024];uint32_t pn=0,p=0;while(p<input_len){if(p+3>input_len){fail(o,40);break;}uint8_t proto=b[p++];uint32_t len=b[p]|((uint32_t)b[p+1]<<8);p+=2;if(p+len>input_len){fail(o,41);break;}o[RECORDS]++;if(proto==1)parse_h2(b+p,len,o,pending,&pn);else if(proto==2)parse_quic(b+p,len,o);else fail(o,42);p+=len;}if(pn)fail(o,43);return o[ERRORS];
}
