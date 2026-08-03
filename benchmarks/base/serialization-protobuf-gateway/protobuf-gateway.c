// Freestanding scalar linear-Wasm protobuf decoder/filter/ProtoJSON serializer.
// Fixed schema and semantics are documented in implementation-contract.v1.json.
typedef unsigned char u8; typedef unsigned int u32; typedef unsigned long long u64; typedef int i32; typedef long long i64;
typedef struct { const u8 *p; u32 n; } Slice;
typedef struct { Slice key; i64 value; } MapEntry;
typedef struct {
  u64 id; Slice name; u32 active; double score; i32 status; Slice tags[8]; u32 tag_n;
  MapEntry maps[8]; u32 map_n; Slice payload; u32 choice; Slice note; int code; float ratio;
} Message;
typedef struct { u32 messages, fields, varint_bytes, unknown, filtered, wire_bytes, json_bytes, allocations, crossings; } Counters;
static u8 *OUT; static u32 OP, OC;
static int emit(u8 b){ if(OP>=OC)return 0; OUT[OP++]=b; return 1; }
static int lit(const char*s){ while(*s)if(!emit((u8)*s++))return 0; return 1; }
static int bytes(const u8*p,u32 n){for(u32 i=0;i<n;i++)if(!emit(p[i]))return 0;return 1;}
static int varint(const u8*b,u32 n,u32*at,u64*v,u32*used){u64 x=0;u32 s=0,start=*at;for(u32 i=0;i<10;i++){if(*at>=n)return 0;u8 c=b[(*at)++];if(i==9&&c>1)return 0;x|=((u64)(c&127))<<s;if(!(c&128)){*v=x;*used=*at-start;return 1;}s+=7;}return 0;}
static int len(const u8*b,u32 n,u32*at,u32*l,u32*used){u64 v;if(!varint(b,n,at,&v,used)||v>(u64)(n-*at))return 0;*l=(u32)v;return 1;}
static int skip(const u8*b,u32 n,u32*at,u32 wire,u32*vu){u64 v;u32 l,u=0;*vu=0;if(wire==0){if(!varint(b,n,at,&v,&u))return 0;*vu=u;return 1;}if(wire==1){if(*at+8>n)return 0;*at+=8;return 1;}if(wire==2){if(!len(b,n,at,&l,&u))return 0;*vu=u;*at+=l;return 1;}if(wire==5){if(*at+4>n)return 0;*at+=4;return 1;}return 0;}
static u32 load32(const u8*p){return (u32)p[0]|((u32)p[1]<<8)|((u32)p[2]<<16)|((u32)p[3]<<24);}
static u64 load64(const u8*p){return (u64)load32(p)|((u64)load32(p+4)<<32);}
static i64 unzig(u64 v){return (i64)((v>>1)^((u64)-(i64)(v&1)));}
static i32 as_i32(u64 v){u32 low=(u32)v;return low&0x80000000U?(i32)((i64)low-4294967296LL):(i32)low;}
static int parse_map(const u8*b,u32 n,MapEntry*e){u32 p=0;e->key.p=0;e->key.n=0;e->value=0;while(p<n){u64 t,v;u32 u,l;if(!varint(b,n,&p,&t,&u))return 0;u32 f=(u32)(t>>3),w=(u32)(t&7);if(f==1&&w==2){if(!len(b,n,&p,&l,&u))return 0;e->key.p=b+p;e->key.n=l;p+=l;}else if(f==2&&w==0){if(!varint(b,n,&p,&v,&u))return 0;e->value=unzig(v);}else if(!skip(b,n,&p,w,&u))return 0;}return 1;}
static int keyeq(Slice a,Slice b){if(a.n!=b.n)return 0;for(u32 i=0;i<a.n;i++)if(a.p[i]!=b.p[i])return 0;return 1;}
static int utf8(const u8*s,u32 n){for(u32 i=0;i<n;){u8 a=s[i++];if(a<128)continue;if(a<194||a>244)return 0;if(a<224){if(i>=n||(s[i]&192)!=128)return 0;i++;continue;}if(a<240){if(i+1>=n||(s[i]&192)!=128||(s[i+1]&192)!=128)return 0;if(a==224&&s[i]<160)return 0;if(a==237&&s[i]>=160)return 0;i+=2;continue;}if(i+2>=n||(s[i]&192)!=128||(s[i+1]&192)!=128||(s[i+2]&192)!=128)return 0;if(a==240&&s[i]<144)return 0;if(a==244&&s[i]>=144)return 0;i+=3;}return 1;}
static int parse(const u8*b,u32 n,Message*m,Counters*c){
  *m=(Message){0};u32 p=0;
  while(p<n){u64 t,v;u32 u,l;if(!varint(b,n,&p,&t,&u))return 0;c->fields++;c->varint_bytes+=u;u32 f=(u32)(t>>3),w=(u32)(t&7);if(!f)return 0;
    if(f==1&&w==0){if(!varint(b,n,&p,&v,&u))return 0;c->varint_bytes+=u;m->id=v;}
    else if(f==2&&w==2){if(!len(b,n,&p,&l,&u)||!utf8(b+p,l))return 0;c->varint_bytes+=u;m->name=(Slice){b+p,l};p+=l;}
    else if(f==3&&w==0){if(!varint(b,n,&p,&v,&u))return 0;c->varint_bytes+=u;m->active=v!=0;}
    else if(f==4&&w==1){if(p+8>n)return 0;u64 q=load64(b+p);__builtin_memcpy(&m->score,&q,8);p+=8;}
    else if(f==5&&w==0){if(!varint(b,n,&p,&v,&u))return 0;c->varint_bytes+=u;m->status=as_i32(v);}
    else if(f==6&&w==2){if(!len(b,n,&p,&l,&u)||m->tag_n>=8||!utf8(b+p,l))return 0;c->varint_bytes+=u;m->tags[m->tag_n++]=(Slice){b+p,l};p+=l;}
    else if(f==7&&w==2){if(!len(b,n,&p,&l,&u))return 0;c->varint_bytes+=u;MapEntry e;if(!parse_map(b+p,l,&e)||!utf8(e.key.p,e.key.n))return 0;p+=l;u32 found=99;for(u32 i=0;i<m->map_n;i++)if(keyeq(m->maps[i].key,e.key))found=i;if(found<8)m->maps[found]=e;else{if(m->map_n>=8)return 0;m->maps[m->map_n++]=e;}}
    else if(f==8&&w==2){if(!len(b,n,&p,&l,&u))return 0;c->varint_bytes+=u;m->payload=(Slice){b+p,l};p+=l;}
    else if(f==9&&w==2){if(!len(b,n,&p,&l,&u)||!utf8(b+p,l))return 0;c->varint_bytes+=u;m->note=(Slice){b+p,l};m->choice=9;p+=l;}
    else if(f==10&&w==0){if(!varint(b,n,&p,&v,&u))return 0;c->varint_bytes+=u;m->code=(int)(u32)v;m->choice=10;}
    else if(f==11&&w==5){if(p+4>n)return 0;u32 q=load32(b+p);__builtin_memcpy(&m->ratio,&q,4);p+=4;}
    else {if(!skip(b,n,&p,w,&u))return 0;c->unknown++;c->varint_bytes+=u;}
  }return 1;
}
static int comma(int*first){if(*first){*first=0;return 1;}return emit(',');}
static int quote(Slice s){if(!emit('"'))return 0;static const char hex[]="0123456789abcdef";for(u32 i=0;i<s.n;i++){u8 b=s.p[i];if(b=='"'){if(!lit("\\\""))return 0;}else if(b=='\\'){if(!lit("\\\\"))return 0;}else if(b==8){if(!lit("\\b"))return 0;}else if(b==9){if(!lit("\\t"))return 0;}else if(b==10){if(!lit("\\n"))return 0;}else if(b==12){if(!lit("\\f"))return 0;}else if(b==13){if(!lit("\\r"))return 0;}else if(b<32){if(!lit("\\u00")||!emit(hex[b>>4])||!emit(hex[b&15]))return 0;}else if(!emit(b))return 0;}return emit('"');}
static int uintdec(u64 v){u8 a[24];u32 n=0;do{a[n++]=(u8)('0'+v%10);v/=10;}while(v);while(n)if(!emit(a[--n]))return 0;return 1;}
static int intdec(i64 v){if(v<0){if(!emit('-'))return 0;return uintdec((u64)(-(v+1))+1);}return uintdec((u64)v);}
static int field(const char*n,int*first){return comma(first)&&emit('"')&&lit(n)&&lit("\":");}
static int b64(Slice s){static const char a[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";if(!emit('"'))return 0;for(u32 i=0;i<s.n;i+=3){u32 x=(u32)s.p[i]<<16;if(i+1<s.n)x|=(u32)s.p[i+1]<<8;if(i+2<s.n)x|=s.p[i+2];if(!emit(a[(x>>18)&63])||!emit(a[(x>>12)&63])||!emit(i+1<s.n?a[(x>>6)&63]:'=')||!emit(i+2<s.n?a[x&63]:'='))return 0;}return emit('"');}
#define BIG_BASE 1000000000U
#define BIG_LIMBS 128
typedef struct {u32 v[BIG_LIMBS];u32 n;} Big;
static void big_init(Big*b,u64 value){b->n=0;while(value){b->v[b->n++]=(u32)(value%BIG_BASE);value/=BIG_BASE;}}
static int big_mul(Big*b,u32 factor){u64 carry=0;for(u32 i=0;i<b->n;i++){u64 x=(u64)b->v[i]*factor+carry;b->v[i]=(u32)(x%BIG_BASE);carry=x/BIG_BASE;}if(carry){if(b->n>=BIG_LIMBS)return 0;b->v[b->n++]=(u32)carry;}return 1;}
static void big_div10(Big*b){u64 carry=0;for(u32 i=b->n;i;i--){u64 x=carry*BIG_BASE+b->v[i-1];b->v[i-1]=(u32)(x/10);carry=x%10;}while(b->n>1&&!b->v[b->n-1])b->n--;}
static u32 big_digits(Big*b,u8*out){u32 p=0;u8 rev[10];u32 n=0,x=b->v[b->n-1];do{rev[n++]=(u8)('0'+x%10);x/=10;}while(x);while(n)out[p++]=rev[--n];for(u32 i=b->n-1;i;i--){u32 place=100000000;for(u32 j=0;j<9;j++){out[p++]=(u8)('0'+(b->v[i-1]/place)%10);place/=10;}}return p;}
static int exact_binary(u64 mantissa,int exponent2,int negative){Big b;big_init(&b,mantissa);u32 places=0;if(exponent2>=0){for(int i=0;i<exponent2;i++)if(!big_mul(&b,2))return 0;}else{places=(u32)-exponent2;for(u32 i=0;i<places;i++)if(!big_mul(&b,5))return 0;while(places&&b.v[0]%10==0){big_div10(&b);places--;}}
  u8 digits[1100];u32 n=big_digits(&b,digits);if(negative&&!emit('-'))return 0;if(!places)return bytes(digits,n);if(n<=places){if(!lit("0."))return 0;for(u32 i=0;i<places-n;i++)if(!emit('0'))return 0;return bytes(digits,n);}u32 point=n-places;return bytes(digits,point)&&emit('.')&&bytes(digits+point,places);
}
static int special_num(double d){u64 bits;__builtin_memcpy(&bits,&d,8);u64 exp=(bits>>52)&2047,frac=bits&0xfffffffffffffULL;if(exp==2047){if(frac)return lit("\"NaN\"");return bits>>63?lit("\"-Infinity\""):lit("\"Infinity\"");}if(bits==0x8000000000000000ULL)return lit("-0");u64 mantissa=frac;if(exp)mantissa|=1ULL<<52;int exponent2=exp?(int)exp-1023-52:-1022-52;return exact_binary(mantissa,exponent2,(int)(bits>>63));}
static int special_float(float f){u32 bits;__builtin_memcpy(&bits,&f,4);u32 exp=(bits>>23)&255,frac=bits&0x7fffff;if(exp==255){if(frac)return lit("\"NaN\"");return bits>>31?lit("\"-Infinity\""):lit("\"Infinity\"");}if(bits==0x80000000)return lit("-0");u64 mantissa=frac;if(exp)mantissa|=1U<<23;int exponent2=exp?(int)exp-127-23:-126-23;return exact_binary(mantissa,exponent2,(int)(bits>>31));}
static int score_present(double d){u64 bits;__builtin_memcpy(&bits,&d,8);return bits!=0;}
static int ratio_present(float f){u32 bits;__builtin_memcpy(&bits,&f,4);return bits!=0;}
static int mapcmp(Slice a,Slice b){u32 n=a.n<b.n?a.n:b.n;for(u32 i=0;i<n;i++){if(a.p[i]<b.p[i])return -1;if(a.p[i]>b.p[i])return 1;}return a.n<b.n?-1:a.n>b.n;}
static int json(Message*m){int first=1;if(!emit('{'))return 0;if(m->id){if(!field("id",&first)||!emit('"')||!uintdec(m->id)||!emit('"'))return 0;}if(m->name.n){if(!field("name",&first)||!quote(m->name))return 0;}if(m->active){if(!field("active",&first)||!lit("true"))return 0;}if(score_present(m->score)){if(!field("score",&first)||!special_num(m->score))return 0;}if(m->status){if(!field("status",&first))return 0;static const Slice st[]={{(const u8*)"STATUS_UNSPECIFIED",18},{(const u8*)"ACTIVE",6},{(const u8*)"PAUSED",6},{(const u8*)"DISABLED",8}};if(m->status>0&&m->status<4){if(!quote(st[m->status]))return 0;}else if(!intdec(m->status))return 0;}if(m->tag_n){if(!field("tags",&first)||!emit('['))return 0;for(u32 i=0;i<m->tag_n;i++){if(i&&!emit(','))return 0;if(!quote(m->tags[i]))return 0;}if(!emit(']'))return 0;}if(m->map_n){if(!field("metrics",&first)||!emit('{'))return 0;u32 idx[8];for(u32 i=0;i<m->map_n;i++)idx[i]=i;for(u32 i=1;i<m->map_n;i++){u32 x=idx[i],j=i;while(j&&mapcmp(m->maps[x].key,m->maps[idx[j-1]].key)<0){idx[j]=idx[j-1];j--;}idx[j]=x;}for(u32 i=0;i<m->map_n;i++){if(i&&!emit(','))return 0;MapEntry*e=&m->maps[idx[i]];if(!quote(e->key)||!emit(':')||!emit('"')||!intdec(e->value)||!emit('"'))return 0;}if(!emit('}'))return 0;}if(m->payload.n){if(!field("payload",&first)||!b64(m->payload))return 0;}if(m->choice==9){if(!field("note",&first)||!quote(m->note))return 0;}else if(m->choice==10){if(!field("code",&first)||!intdec(m->code))return 0;}if(ratio_present(m->ratio)){if(!field("ratio",&first)||!special_float(m->ratio))return 0;}return emit('}');}
__attribute__((export_name("process"))) int process(u32 input,u32 input_len,u32 output,u32 output_cap,u32 counters){
 const u8*b=(const u8*)(u64)input;if(input_len<4)return -1;u32 count=load32(b);if(count!=10000)return -2;u32 p=4;OUT=(u8*)(u64)output;OP=0;OC=output_cap;Counters c={0};c.wire_bytes=input_len;c.crossings=1;if(!emit('['))return -3;int first=1;
 for(u32 i=0;i<count;i++){if(p+4>input_len)return -4;u32 n=load32(b+p);p+=4;if(p+n>input_len)return -5;Message m;if(!parse(b+p,n,&m,&c))return -6;p+=n;c.messages++;if(m.active&&m.status!=3&&m.id%3==0){if(!comma(&first)||!json(&m))return -7;c.filtered++;}}
 if(p!=input_len||!emit(']'))return -8;c.json_bytes=OP;u32*dst=(u32*)(u64)counters;dst[0]=c.messages;dst[1]=c.fields;dst[2]=c.varint_bytes;dst[3]=c.unknown;dst[4]=c.filtered;dst[5]=c.wire_bytes;dst[6]=c.json_bytes;dst[7]=0;dst[8]=c.crossings;dst[9]=0;return (int)OP;
}
