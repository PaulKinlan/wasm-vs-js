typedef unsigned char u8;
typedef unsigned int u32;
typedef unsigned long long u64;

static u32 load32(const u8 *p) {
  return (u32)p[0] | ((u32)p[1] << 8) | ((u32)p[2] << 16) | ((u32)p[3] << 24);
}
static void store32(u8 *p, u32 x) {
  p[0] = (u8)x; p[1] = (u8)(x >> 8); p[2] = (u8)(x >> 16); p[3] = (u8)(x >> 24);
}
static void store64(u8 *p, u64 x) {
  for (u32 i = 0; i < 8; i++) { p[i] = (u8)x; x >>= 8; }
}
static u32 rotl(u32 x, u32 n) { return (x << n) | (x >> (32 - n)); }
#define QR(a,b,c,d) do { \
  a += b; d = rotl(d ^ a,16); c += d; b = rotl(b ^ c,12); \
  a += b; d = rotl(d ^ a, 8); c += d; b = rotl(b ^ c, 7); \
} while (0)

static void chacha_block(const u8 *key, u32 counter, const u8 *nonce, u8 *out) {
  u32 x[16], initial[16];
  initial[0]=0x61707865; initial[1]=0x3320646e; initial[2]=0x79622d32; initial[3]=0x6b206574;
  for (u32 i=0;i<8;i++) initial[4+i]=load32(key+i*4);
  initial[12]=counter; initial[13]=load32(nonce); initial[14]=load32(nonce+4); initial[15]=load32(nonce+8);
  for (u32 i=0;i<16;i++) x[i]=initial[i];
  for (u32 i=0;i<10;i++) {
    QR(x[0],x[4],x[8],x[12]); QR(x[1],x[5],x[9],x[13]);
    QR(x[2],x[6],x[10],x[14]); QR(x[3],x[7],x[11],x[15]);
    QR(x[0],x[5],x[10],x[15]); QR(x[1],x[6],x[11],x[12]);
    QR(x[2],x[7],x[8],x[13]); QR(x[3],x[4],x[9],x[14]);
  }
  for (u32 i=0;i<16;i++) store32(out+i*4,x[i]+initial[i]);
}

static void stream_xor(const u8 *key,const u8 *nonce,const u8 *in,u32 len,u8 *out) {
  u8 block[64]; u32 counter=1;
  for (u32 off=0;off<len;off+=64,counter++) {
    chacha_block(key,counter,nonce,block);
    u32 n=len-off<64?len-off:64;
    for(u32 i=0;i<n;i++) out[off+i]=in[off+i]^block[i];
  }
}

/* 26-bit-limb Poly1305, authored from RFC 8439 arithmetic. */
typedef struct { u32 r0,r1,r2,r3,r4; u32 s1,s2,s3,s4; u32 h0,h1,h2,h3,h4; u32 pad0,pad1,pad2,pad3; } poly_state;
static void poly_init(poly_state *st,const u8 key[32]) {
  u32 t0=load32(key),t1=load32(key+4),t2=load32(key+8),t3=load32(key+12);
  st->r0=t0&0x3ffffff; st->r1=((t0>>26)|(t1<<6))&0x3ffff03;
  st->r2=((t1>>20)|(t2<<12))&0x3ffc0ff; st->r3=((t2>>14)|(t3<<18))&0x3f03fff;
  st->r4=(t3>>8)&0x00fffff; st->s1=st->r1*5; st->s2=st->r2*5; st->s3=st->r3*5; st->s4=st->r4*5;
  st->h0=st->h1=st->h2=st->h3=st->h4=0;
  st->pad0=load32(key+16); st->pad1=load32(key+20); st->pad2=load32(key+24); st->pad3=load32(key+28);
}
static void poly_block(poly_state *st,const u8 m[16],u32 hibit) {
  u32 t0=load32(m),t1=load32(m+4),t2=load32(m+8),t3=load32(m+12);
  u32 h0=st->h0+(t0&0x3ffffff),h1=st->h1+(((t0>>26)|(t1<<6))&0x3ffffff);
  u32 h2=st->h2+(((t1>>20)|(t2<<12))&0x3ffffff),h3=st->h3+(((t2>>14)|(t3<<18))&0x3ffffff);
  u32 h4=st->h4+(t3>>8)+hibit;
  u64 d0=(u64)h0*st->r0+(u64)h1*st->s4+(u64)h2*st->s3+(u64)h3*st->s2+(u64)h4*st->s1;
  u64 d1=(u64)h0*st->r1+(u64)h1*st->r0+(u64)h2*st->s4+(u64)h3*st->s3+(u64)h4*st->s2;
  u64 d2=(u64)h0*st->r2+(u64)h1*st->r1+(u64)h2*st->r0+(u64)h3*st->s4+(u64)h4*st->s3;
  u64 d3=(u64)h0*st->r3+(u64)h1*st->r2+(u64)h2*st->r1+(u64)h3*st->r0+(u64)h4*st->s4;
  u64 d4=(u64)h0*st->r4+(u64)h1*st->r3+(u64)h2*st->r2+(u64)h3*st->r1+(u64)h4*st->r0;
  u32 c=(u32)(d0>>26); h0=(u32)d0&0x3ffffff; d1+=c;
  c=(u32)(d1>>26); h1=(u32)d1&0x3ffffff; d2+=c;
  c=(u32)(d2>>26); h2=(u32)d2&0x3ffffff; d3+=c;
  c=(u32)(d3>>26); h3=(u32)d3&0x3ffffff; d4+=c;
  c=(u32)(d4>>26); h4=(u32)d4&0x3ffffff; h0+=c*5;
  c=h0>>26; h0&=0x3ffffff; h1+=c;
  st->h0=h0;st->h1=h1;st->h2=h2;st->h3=h3;st->h4=h4;
}
static void poly_update(poly_state *st,const u8 *m,u32 len) {
  while(len>=16){poly_block(st,m,1<<24);m+=16;len-=16;}
  if(len){u8 block[16];u32 i=0;for(;i<len;i++)block[i]=m[i];block[i++]=1;for(;i<16;i++)block[i]=0;poly_block(st,block,0);}
}
static void poly_finish(poly_state *st,u8 tag[16]) {
  u32 h0=st->h0,h1=st->h1,h2=st->h2,h3=st->h3,h4=st->h4,c;
  c=h1>>26;h1&=0x3ffffff;h2+=c;c=h2>>26;h2&=0x3ffffff;h3+=c;
  c=h3>>26;h3&=0x3ffffff;h4+=c;c=h4>>26;h4&=0x3ffffff;h0+=c*5;c=h0>>26;h0&=0x3ffffff;h1+=c;
  u32 g0=h0+5; c=g0>>26;g0&=0x3ffffff;u32 g1=h1+c;c=g1>>26;g1&=0x3ffffff;
  u32 g2=h2+c;c=g2>>26;g2&=0x3ffffff;u32 g3=h3+c;c=g3>>26;g3&=0x3ffffff;u32 g4=h4+c-(1<<26);
  u32 mask=(g4>>31)-1,nmask=~mask;h0=(h0&nmask)|(g0&mask);h1=(h1&nmask)|(g1&mask);
  h2=(h2&nmask)|(g2&mask);h3=(h3&nmask)|(g3&mask);h4=(h4&nmask)|(g4&mask);
  u64 f0=(u32)(h0|(h1<<26))+(u64)st->pad0;
  u64 f1=(u32)((h1>>6)|(h2<<20))+(u64)st->pad1+(f0>>32);
  u64 f2=(u32)((h2>>12)|(h3<<14))+(u64)st->pad2+(f1>>32);
  u64 f3=(u32)((h3>>18)|(h4<<8))+(u64)st->pad3+(f2>>32);
  store32(tag,(u32)f0);store32(tag+4,(u32)f1);store32(tag+8,(u32)f2);store32(tag+12,(u32)f3);
}
static void poly_padded(poly_state *st,const u8 *m,u32 len){
  while(len>=16){poly_block(st,m,1<<24);m+=16;len-=16;}
  if(len){u8 block[16];u32 i=0;for(;i<len;i++)block[i]=m[i];for(;i<16;i++)block[i]=0;poly_block(st,block,1<<24);}
}
static void aead_tag(const u8 *key,const u8 *nonce,const u8 *aad,u32 aad_len,const u8 *ct,u32 len,u8 tag[16]) {
  u8 block[64],lengths[16];chacha_block(key,0,nonce,block);poly_state st;poly_init(&st,block);
  poly_padded(&st,aad,aad_len);poly_padded(&st,ct,len);
  store64(lengths,aad_len);store64(lengths+8,len);poly_update(&st,lengths,16);poly_finish(&st,tag);
}
__attribute__((export_name("seal"))) int seal(const u8 *key,const u8 *nonce,const u8 *aad,u32 aad_len,const u8 *plain,u32 len,u8 *out,u8 *tag){stream_xor(key,nonce,plain,len,out);aead_tag(key,nonce,aad,aad_len,out,len,tag);return (int)len;}
__attribute__((export_name("open"))) int open(const u8 *key,const u8 *nonce,const u8 *aad,u32 aad_len,const u8 *ct,u32 len,const u8 *tag,u8 *out){u8 expected[16];aead_tag(key,nonce,aad,aad_len,ct,len,expected);u32 diff=0;for(u32 i=0;i<16;i++)diff|=expected[i]^tag[i];if(diff)return -1;stream_xor(key,nonce,ct,len,out);return (int)len;}
