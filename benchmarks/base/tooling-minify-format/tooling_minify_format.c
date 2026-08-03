#include <stdint.h>
static uint32_t g_tokens,g_nodes,g_transforms;
static int ws(uint8_t b){return b==32||b==9||b==10||b==13;}
static int word(uint8_t b){return b>=128||(b>='0'&&b<='9')||(b>='A'&&b<='Z')||(b>='a'&&b<='z')||b=='_'||b=='$'||b=='-';}
static int starts(const uint8_t*p,uint32_t n,uint32_t i,const char*s,uint32_t z){if(i+z>n)return 0;for(uint32_t j=0;j<z;j++)if(p[i+j]!=(uint8_t)s[j])return 0;return 1;}
static int tag_eq(const uint8_t*p,uint32_t n,const char*s){uint32_t i=0;while(s[i]){if(i>=n||p[i]!=(uint8_t)s[i])return 0;i++;}return i==n;}
static int validate_html(const uint8_t*p,uint32_t n){int depth=0;for(uint32_t i=0;i<n;){if(p[i]!='<'){i++;continue;}uint32_t j=i;while(j<n&&p[j]!='>')j++;if(j==n)return -6;int closing=i+1<n&&p[i+1]=='/',decl=i+1<n&&p[i+1]=='!',self=(j>i&&p[j-1]=='/')||decl;uint32_t a=i+(closing?2:1),z=a;while(z<j&&!ws(p[z])&&p[z]!='/'&&p[z]!='>')z++;if(tag_eq(p+a,z-a,"meta")||tag_eq(p+a,z-a,"link")||tag_eq(p+a,z-a,"img")||tag_eq(p+a,z-a,"br")||tag_eq(p+a,z-a,"hr")||tag_eq(p+a,z-a,"input"))self=1;if(closing&&--depth<0)return -7;if(!closing&&!self)depth++;i=j+1;}return depth?-7:0;}
static int clean(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t cap,int lang){
 uint32_t o=0;int quote=0,esc=0,pending=0,inword=0,braces=0;g_tokens=g_nodes=g_transforms=0;
 for(uint32_t i=0;i<n;){uint8_t b=in[i];
  if(quote){if(o>=cap)return -10;out[o++]=b;if(esc)esc=0;else if(b=='\\')esc=1;else if(b==quote)quote=0;i++;continue;}
  if(lang==3&&starts(in,n,i,"<!--",4)){uint32_t j=i+4;while(j+2<n&&!starts(in,n,j,"-->",3))j++;if(j+2>=n)return -2;i=j+3;g_transforms++;pending=1;continue;}
  if(lang!=3&&i+1<n&&b=='/'&&in[i+1]=='*'){uint32_t j=i+2;while(j+1<n&&!(in[j]=='*'&&in[j+1]=='/'))j++;if(j+1>=n)return -3;i=j+2;g_transforms++;pending=1;continue;}
  if(lang==1&&i+1<n&&b=='/'&&in[i+1]=='/'){i+=2;while(i<n&&in[i]!='\n')i++;g_transforms++;pending=1;continue;}
  if(ws(b)){pending=1;i++;continue;}
  int cw=word(b);if(pending&&o&&word(out[o-1])&&cw){if(o>=cap)return -10;out[o++]=' ';}pending=0;
  if(b=='"'||b=='\''||(lang==1&&b=='`')){quote=b;g_tokens++;inword=0;}else if(cw){if(!inword)g_tokens++;inword=1;}else{g_tokens++;inword=0;}
  if(lang!=3){if(b=='{'){braces++;g_nodes++;}else if(b=='}'){if(--braces<0)return -4;g_nodes++;}else if(b==';')g_nodes++;}else if(b=='<')g_nodes++;
  if(o>=cap)return -10;out[o++]=b;i++;
 }
 if(quote)return -5;if(braces)return -4;if(lang==3){int valid=validate_html(out,o);if(valid<0)return valid;}return (int)o;
}
static int add_indent(uint8_t*out,uint32_t*o,uint32_t cap,int depth){for(int i=0;i<depth*2;i++){if(*o>=cap)return 0;out[(*o)++]=' ';}return 1;}
static void trim_space(uint8_t*out,uint32_t*o){while(*o&&out[*o-1]==' ')(*o)--;}
static int newline(uint8_t*out,uint32_t*o,uint32_t cap){trim_space(out,o);if(!*o||out[*o-1]!='\n'){if(*o>=cap)return 0;out[(*o)++]='\n';}return 1;}
static int format_braced(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t cap){uint32_t o=0;int depth=0,line=1,quote=0,esc=0;
 for(uint32_t i=0;i<n;i++){uint8_t b=in[i];
  if(quote){if(line){if(!add_indent(out,&o,cap,depth))return -10;line=0;}if(o>=cap)return -10;out[o++]=b;if(esc)esc=0;else if(b=='\\')esc=1;else if(b==quote)quote=0;continue;}
  if(b=='"'||b=='\''||b=='`'){if(line){if(!add_indent(out,&o,cap,depth))return -10;line=0;}quote=b;if(o>=cap)return -10;out[o++]=b;}
  else if(b=='{'){if(line){if(!add_indent(out,&o,cap,depth))return -10;line=0;}if(o&&out[o-1]!=' '){if(o>=cap)return -10;out[o++]=' ';}if(o>=cap)return -10;out[o++]=b;depth++;if(!newline(out,&o,cap))return -10;line=1;}
  else if(b=='}'){depth--;if(!newline(out,&o,cap))return -10;line=1;if(!add_indent(out,&o,cap,depth))return -10;line=0;if(o>=cap)return -10;out[o++]=b;if(!newline(out,&o,cap))return -10;line=1;}
  else if(b==';'){if(line){if(!add_indent(out,&o,cap,depth))return -10;line=0;}if(o>=cap)return -10;out[o++]=b;if(!newline(out,&o,cap))return -10;line=1;}
  else {if(line){if(!add_indent(out,&o,cap,depth))return -10;line=0;}if(o>=cap)return -10;out[o++]=b;}
 }
 while(o&&out[o-1]=='\n')o--;if(o>=cap)return -10;out[o++]='\n';return (int)o;}
static int eqtag(const uint8_t*p,uint32_t n,const char*s){uint32_t i=0;while(s[i]){if(i>=n||p[i]!=(uint8_t)s[i])return 0;i++;}return i==n;}
static int format_html(const uint8_t*in,uint32_t n,uint8_t*out,uint32_t cap){uint32_t o=0,i=0;int depth=0;
 while(i<n){if(in[i]!='<'){uint32_t j=i;while(j<n&&in[j]!='<')j++;if(j>i){if(!add_indent(out,&o,cap,depth)||o+(j-i)+1>cap)return -10;for(uint32_t k=i;k<j;k++)out[o++]=in[k];out[o++]='\n';}i=j;continue;}
  uint32_t j=i;while(j<n&&in[j]!='>')j++;if(j==n)return -6;int closing=(i+1<n&&in[i+1]=='/'),decl=(i+1<n&&in[i+1]=='!'),self=(j>i&&in[j-1]=='/')||decl;
  uint32_t a=i+(closing?2:1),z=a;while(z<j&&!ws(in[z])&&in[z]!='/'&&in[z]!='>')z++;
  if(eqtag(in+a,z-a,"meta")||eqtag(in+a,z-a,"link")||eqtag(in+a,z-a,"img")||eqtag(in+a,z-a,"br")||eqtag(in+a,z-a,"hr")||eqtag(in+a,z-a,"input"))self=1;
  if(closing&&--depth<0)return -7;if(!add_indent(out,&o,cap,depth)||o+(j-i+2)>cap)return -10;for(uint32_t k=i;k<=j;k++)out[o++]=in[k];out[o++]='\n';if(!closing&&!self)depth++;i=j+1;
 }
 if(depth)return -7;return (int)o;}
__attribute__((export_name("transform"))) int transform(uint32_t inptr,uint32_t n,uint32_t tmpptr,uint32_t outptr,uint32_t cap,int lang,int op){uint8_t*in=(uint8_t*)(uintptr_t)inptr,*tmp=(uint8_t*)(uintptr_t)tmpptr,*out=(uint8_t*)(uintptr_t)outptr;int m=clean(in,n,tmp,cap,lang);if(m<0)return m;if(op==1){for(int i=0;i<m;i++)out[i]=tmp[i];return m;}if(op!=2)return -8;g_transforms+=g_nodes;return lang==3?format_html(tmp,(uint32_t)m,out,cap):format_braced(tmp,(uint32_t)m,out,cap);}
__attribute__((export_name("tokens"))) uint32_t tokens(void){return g_tokens;}
__attribute__((export_name("nodes"))) uint32_t nodes(void){return g_nodes;}
__attribute__((export_name("transforms"))) uint32_t transforms(void){return g_transforms;}
