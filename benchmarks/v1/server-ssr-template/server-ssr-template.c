// Material linear-Wasm implementation of server.ssr-template.v1.
// No libc, host rendering, callbacks, imports, or JavaScript post-rendering.
typedef unsigned char u8;
typedef unsigned int u32;
typedef int i32;

#define INPUT_PTR 1048576u
#define COUNTERS_PTR 1572864u
#define OUTPUT_PTR 2097152u
#define FIXTURE_MAGIC 0x31465353u
#define OUTPUT_MAGIC 0x314f5353u
#define RECORDS 1000u
#define TOKENS_PER_RESPONSE 23u

typedef struct { u8 *p; u32 cap; u32 at; i32 failed; } Writer;
typedef struct { const u8 *p; u32 len; u32 at; i32 failed; } Reader;
typedef struct { u32 product_id, user_id, price_cents, date_ymd; const u8 *name, *user, *slug; u32 name_n, user_n, slug_n; } Record;

static u32 load32(const u8 *p) { return (u32)p[0] | ((u32)p[1] << 8) | ((u32)p[2] << 16) | ((u32)p[3] << 24); }
static void store32(u8 *p, u32 v) { p[0]=(u8)v; p[1]=(u8)(v>>8); p[2]=(u8)(v>>16); p[3]=(u8)(v>>24); }

static u32 read32(Reader *r) {
  if (r->failed || r->at > r->len || r->len-r->at < 4u) { r->failed=1; return 0; }
  u32 v=load32(r->p+r->at); r->at+=4; return v;
}
static i32 valid_utf8(const u8 *p, u32 n) {
  u32 i=0;
  while (i<n) {
    u32 c=p[i++];
    if (c<0x80u) continue;
    u32 need=0, min=0, value=0;
    if ((c&0xe0u)==0xc0u) { need=1; min=0x80u; value=c&0x1fu; }
    else if ((c&0xf0u)==0xe0u) { need=2; min=0x800u; value=c&0x0fu; }
    else if ((c&0xf8u)==0xf0u) { need=3; min=0x10000u; value=c&0x07u; }
    else return 0;
    if (i+need>n) return 0;
    for (u32 j=0;j<need;j++) { u32 d=p[i++]; if ((d&0xc0u)!=0x80u) return 0; value=(value<<6)|(d&0x3fu); }
    if (value<min || value>0x10ffffu || (value>=0xd800u && value<=0xdfffu)) return 0;
  }
  return 1;
}
static const u8 *read_bytes(Reader *r, u32 *n) {
  *n=read32(r);
  if (r->failed || *n>65536u || r->at>r->len || *n>r->len-r->at) { r->failed=1; return (const u8*)0; }
  const u8 *p=r->p+r->at; r->at+=*n;
  if (!valid_utf8(p,*n)) { r->failed=1; return (const u8*)0; }
  return p;
}
static Record read_record(Reader *r) {
  Record x;
  x.product_id=read32(r); x.user_id=read32(r); x.price_cents=read32(r); x.date_ymd=read32(r);
  x.name=read_bytes(r,&x.name_n); x.user=read_bytes(r,&x.user_n); x.slug=read_bytes(r,&x.slug_n);
  return x;
}

static void byte(Writer *w,u32 v) { if (w->failed || w->at>=w->cap) {w->failed=1;return;} w->p[w->at++]=(u8)v; }
static void bytes(Writer *w,const u8 *p,u32 n) { if(w->failed||w->at>w->cap||n>w->cap-w->at){w->failed=1;return;} for(u32 i=0;i<n;i++)w->p[w->at+i]=p[i]; w->at+=n; }
#define LIT(w,s) bytes((w),(const u8*)(s),(u32)(sizeof(s)-1))
static void u32out(Writer *w,u32 v) { if(w->failed||w->at>w->cap||4u>w->cap-w->at){w->failed=1;return;} store32(w->p+w->at,v);w->at+=4; }
static void decimal(Writer *w,u32 v,u32 minimum) { u8 d[10];u32 n=0;do{d[n++]=(u8)(48u+v%10u);v/=10u;}while(v||n<minimum);while(n)byte(w,d[--n]); }
static void text_escape(Writer *w,const u8 *p,u32 n) { for(u32 i=0;i<n;i++){u32 c=p[i];if(c==38)LIT(w,"&amp;");else if(c==60)LIT(w,"&lt;");else if(c==62)LIT(w,"&gt;");else byte(w,c);} }
static void attr_escape(Writer *w,const u8 *p,u32 n) { for(u32 i=0;i<n;i++){u32 c=p[i];if(c==38)LIT(w,"&amp;");else if(c==60)LIT(w,"&lt;");else if(c==62)LIT(w,"&gt;");else if(c==34)LIT(w,"&quot;");else if(c==39)LIT(w,"&#39;");else byte(w,c);} }
static i32 unreserved(u32 c){return(c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c==45||c==46||c==95||c==126;}
static void url_escape(Writer *w,const u8 *p,u32 n){static const u8 hex[]="0123456789ABCDEF";for(u32 i=0;i<n;i++){u32 c=p[i];if(unreserved(c))byte(w,c);else{byte(w,37);byte(w,hex[c>>4]);byte(w,hex[c&15]);}}}
static i32 date(Writer *w,u32 ymd){u32 y=ymd/10000u,m=(ymd/100u)%100u,d=ymd%100u;if(y<2026u||y>9999u||m<1u||m>12u||d<1u||d>28u)return 0;decimal(w,y,4);byte(w,45);decimal(w,m,2);byte(w,45);decimal(w,d,2);return 1;}
static void price(Writer *w,u32 cents){decimal(w,cents/100u,1);byte(w,46);decimal(w,cents%100u,2);}

static i32 render_record(Writer *w,const Record *r){
  LIT(w,"<!doctype html><html lang=\"en\"><body><article data-product=\"");
  decimal(w,r->product_id,1);LIT(w,"\"><h1>");text_escape(w,r->name,r->name_n);
  LIT(w,"</h1><p data-user=\"");decimal(w,r->user_id,1);LIT(w,"\" aria-label=\"Catalog for ");
  attr_escape(w,r->user,r->user_n);LIT(w,"\">Hello, ");text_escape(w,r->user,r->user_n);
  LIT(w,".</p><p class=\"price\" data-cents=\"");decimal(w,r->price_cents,1);LIT(w,"\">USD ");price(w,r->price_cents);
  LIT(w,"</p><a href=\"/catalog/");url_escape(w,r->slug,r->slug_n);LIT(w,"?for=");url_escape(w,r->user,r->user_n);
  LIT(w,"\">Open</a><time datetime=\"");if(!date(w,r->date_ymd))return 0;LIT(w,"\">");if(!date(w,r->date_ymd))return 0;
  LIT(w,"</time></article></body></html>");return !w->failed;
}

__attribute__((export_name("input_ptr"))) u32 input_ptr(void){return INPUT_PTR;}
__attribute__((export_name("output_ptr"))) u32 output_ptr(void){return OUTPUT_PTR;}
__attribute__((export_name("counters_ptr"))) u32 counters_ptr(void){return COUNTERS_PTR;}
__attribute__((export_name("render_corpus"))) i32 render_corpus(u32 in,u32 in_len,u32 out,u32 out_cap,u32 counters){
  if(in!=INPUT_PTR||out!=OUTPUT_PTR||counters!=COUNTERS_PTR||in_len<8u||out_cap>4194304u)return -1;
  Reader rd={(const u8*)(unsigned long)in,in_len,0,0};
  if(read32(&rd)!=FIXTURE_MAGIC||read32(&rd)!=RECORDS||rd.failed)return -2;
  Writer wr={(u8*)(unsigned long)out,out_cap,0,0};u32out(&wr,OUTPUT_MAGIC);u32out(&wr,RECORDS);
  for(u32 i=0;i<RECORDS;i++){
    Record r=read_record(&rd);if(rd.failed)return -3;
    u32 length_at=wr.at;u32out(&wr,0);u32 start=wr.at;
    if(!render_record(&wr,&r)||wr.failed)return -4;
    store32(wr.p+length_at,wr.at-start);
  }
  if(rd.failed||rd.at!=rd.len)return -5;
  u32 *c=(u32*)(unsigned long)counters;
  c[0]=RECORDS;c[1]=RECORDS*7u;c[2]=RECORDS*TOKENS_PER_RESPONSE;c[3]=RECORDS*2u;c[4]=RECORDS;
  c[5]=RECORDS*2u;c[6]=RECORDS*4u;c[7]=RECORDS*2u;c[8]=in_len;c[9]=wr.at;c[10]=1u;c[11]=1u;
  return (i32)wr.at;
}
