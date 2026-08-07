#include <stdint.h>
#include <stddef.h>
// simulation-rigid-body-2d multilang kernel — exact mirror of
// benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c (and the
// engine.js oracle): 500-body 2D physics with SAT collision, joints,
// torque, quantized state, and checkpoints. Float32 semantics preserved
// exactly (no contraction, no reassociation) so output is bit-identical.
#define BODIES 500u
#define JOINTS 19u
#define HEADER_BYTES 96u
#define BODY_WORDS 11u
#define JOINT_BYTES 32u
#define FIXTURE_BYTES (HEADER_BYTES + BODIES * BODY_WORDS * 4u + JOINTS * JOINT_BYTES)
#define MAX_PAIRS 8192u
#define MAX_CHECKPOINTS 6u
#define STATE_VALUES (BODIES * 6u)
#define PI 3.1415927410125732f
#define TAU 6.2831854820251465f
static uint8_t fixture[FIXTURE_BYTES];
static float x[BODIES], y[BODIES], angle[BODIES], vx[BODIES], vy[BODIES], omega[BODIES];
static float inv_mass[BODIES], inv_inertia[BODIES], half_x[BODIES], half_y[BODIES], torque[BODIES];
static float cosine[BODIES], sine[BODIES], extent_x[BODIES], extent_y[BODIES];
static uint32_t joint_a[JOINTS], joint_b[JOINTS];
static float local_ax[JOINTS], local_ay[JOINTS], local_bx[JOINTS], local_by[JOINTS], joint_rest[JOINTS], joint_stiffness[JOINTS];
static uint32_t order[BODIES], pair_a[MAX_PAIRS], pair_b[MAX_PAIRS];
struct Result { uint32_t c[13]; uint32_t reserved[3]; float checkpoints[MAX_CHECKPOINTS * STATE_VALUES]; };
static struct Result result;
struct Manifold { float nx, ny, penetration, cx, cy; };
struct JointGeometry { uint32_t a,b; float rax,ray,rbx,rby,length,nx,ny; };
static uint32_t u32(uint32_t o){return fixture[o]|((uint32_t)fixture[o+1]<<8)|((uint32_t)fixture[o+2]<<16)|((uint32_t)fixture[o+3]<<24);}
static float f32(uint32_t o){union{uint32_t u;float f;}v;v.u=u32(o);return v.f;}
static float absf(float a){return a<0?-a:a;} static float sqrtf0(float a){return __builtin_sqrtf(a);}
static float add(float a,float b){return a+b;} static float sub(float a,float b){return a-b;} static float mul(float a,float b){return a*b;} static float divf(float a,float b){return a/b;}
static float wrap(float a){while(a>PI)a-=TAU;while(a<-PI)a+=TAU;return a;}
static float sin_approx(float x){x=wrap(x);float x2=x*x;return x+(x*x2)*((-1.0f/6.0f)+x2*((1.0f/120.0f)+x2*(-1.0f/5040.0f)));}
static float cos_approx(float x){x=wrap(x);float x2=x*x;return 1.0f+x2*((-1.0f/2.0f)+x2*((1.0f/24.0f)+x2*(-1.0f/720.0f)));}
static float quantize(float a){float s=a*1000.0f;int32_t r=(int32_t)(s<0?s-0.5f:s+0.5f);return (float)r/1000.0f;}
static float cross(float ax,float ay,float bx,float by){return ax*by-ay*bx;}
static float clampf(float v,float lo,float hi){return v<lo?lo:(v>hi?hi:v);}
extern "C" __attribute__((visibility("default"))) uint32_t fixture_ptr(void){return(uint32_t)(uintptr_t)fixture;}
extern "C" __attribute__((visibility("default"))) uint32_t result_ptr(void){return(uint32_t)(uintptr_t)&result;}
static void update_basis(void){for(uint32_t i=0;i<BODIES;i++){float c=cos_approx(angle[i]),s=sin_approx(angle[i]);cosine[i]=c;sine[i]=s;extent_x[i]=absf(c)*half_x[i]+absf(s)*half_y[i];extent_y[i]=absf(s)*half_x[i]+absf(c)*half_y[i];}}
static int sat(uint32_t a,uint32_t b,struct Manifold*m){
 float dx=x[b]-x[a],dy=y[b]-y[a],minimum=3.402823e38f,nx=0,ny=0;
 float axes[8]={cosine[a],sine[a],-sine[a],cosine[a],cosine[b],sine[b],-sine[b],cosine[b]};
 for(uint32_t k=0;k<4;k++){float ax=axes[k*2],ay=axes[k*2+1],d=dx*ax+dy*ay;
  float au=absf(ax*cosine[a]+ay*sine[a]),av=absf(ax*-sine[a]+ay*cosine[a]);
  float bu=absf(ax*cosine[b]+ay*sine[b]),bv=absf(ax*-sine[b]+ay*cosine[b]);
  float radius=half_x[a]*au+half_y[a]*av+half_x[b]*bu+half_y[b]*bv,overlap=radius-absf(d);
  if(overlap<=0)return 0;if(overlap<minimum){minimum=overlap;float sign=d<0?-1.0f:1.0f;nx=ax*sign;ny=ay*sign;}}
 float sau=(nx*cosine[a]+ny*sine[a])<0?-1.0f:1.0f,sav=(nx*-sine[a]+ny*cosine[a])<0?-1.0f:1.0f;
 float sbu=((-nx)*cosine[b]+(-ny)*sine[b])<0?-1.0f:1.0f,sbv=((-nx)*-sine[b]+(-ny)*cosine[b])<0?-1.0f:1.0f;
 float sax=x[a]+sau*half_x[a]*cosine[a]+sav*half_y[a]*-sine[a],say=y[a]+sau*half_x[a]*sine[a]+sav*half_y[a]*cosine[a];
 float sbx=x[b]+sbu*half_x[b]*cosine[b]+sbv*half_y[b]*-sine[b],sby=y[b]+sbu*half_x[b]*sine[b]+sbv*half_y[b]*cosine[b];
 m->nx=nx;m->ny=ny;m->penetration=minimum;m->cx=(sax+sbx)*0.5f;m->cy=(say+sby)*0.5f;return 1;}
static int ground_manifold(uint32_t i,struct Manifold*m){float su=sine[i]>0?-1.0f:1.0f,sv=cosine[i]>0?-1.0f:1.0f;float rx=su*half_x[i]*cosine[i]+sv*half_y[i]*-sine[i],ry=su*half_x[i]*sine[i]+sv*half_y[i]*cosine[i],lowest=y[i]+ry;if(lowest>=0)return 0;m->nx=0;m->ny=-1;m->penetration=-lowest;m->cx=x[i]+rx;m->cy=0;return 1;}
static uint32_t build_pairs(void){update_basis();for(uint32_t k=1;k<BODIES;k++){uint32_t id=order[k],at=k;float key=x[id]-extent_x[id];while(at>0){uint32_t p=order[at-1];float pk=x[p]-extent_x[p];if(pk<key||(pk==key&&p<id))break;order[at]=p;at--;}order[at]=id;}uint32_t count=0;for(uint32_t l=0;l<BODIES;l++){uint32_t a=order[l];float mx=x[a]+extent_x[a];for(uint32_t r=l+1;r<BODIES;r++){uint32_t b=order[r];if(x[b]-extent_x[b]>mx)break;result.c[1]++;if(absf(y[b]-y[a])<=extent_y[a]+extent_y[b]){if(count>=MAX_PAIRS)return 0xffffffffu;pair_a[count]=a;pair_b[count]=b;count++;}}}return count;}
static void contact_velocity(struct Manifold*m,uint32_t a,int32_t b,float restitution,float friction){
 float rax=m->cx-x[a],ray=m->cy-y[a],vax=vx[a]-omega[a]*ray,vay=vy[a]+omega[a]*rax;
 float inverse=inv_mass[a],rbx=0,rby=0,vbx=0,vby=0;if(b>=0){rbx=m->cx-x[b];rby=m->cy-y[b];vbx=vx[b]-omega[b]*rby;vby=vy[b]+omega[b]*rbx;inverse+=inv_mass[b];}
 float rna=cross(rax,ray,m->nx,m->ny),denom=inverse+rna*rna*inv_inertia[a],rnb=0;if(b>=0){rnb=cross(rbx,rby,m->nx,m->ny);denom+=rnb*rnb*inv_inertia[b];}
 float relx=vbx-vax,rely=vby-vay,nv=relx*m->nx+rely*m->ny;if(nv>=0||denom<=0)return;float impulse=-(1.0f+restitution)*nv/denom,ix=impulse*m->nx,iy=impulse*m->ny;
 vx[a]-=ix*inv_mass[a];vy[a]-=iy*inv_mass[a];omega[a]-=rna*impulse*inv_inertia[a];if(b>=0){vx[b]+=ix*inv_mass[b];vy[b]+=iy*inv_mass[b];omega[b]+=rnb*impulse*inv_inertia[b];}result.c[5]++;if(rna!=0)result.c[7]++;if(b>=0&&rnb!=0)result.c[7]++;
 float tx=-m->ny,ty=m->nx,rta=cross(rax,ray,tx,ty),tden=inverse+rta*rta*inv_inertia[a],rtb=0;if(b>=0){rtb=cross(rbx,rby,tx,ty);tden+=rtb*rtb*inv_inertia[b];}
 float ti=clampf(-(relx*tx+rely*ty)/tden,-friction*impulse,friction*impulse),fx=ti*tx,fy=ti*ty;vx[a]-=fx*inv_mass[a];vy[a]-=fy*inv_mass[a];omega[a]-=rta*ti*inv_inertia[a];if(b>=0){vx[b]+=fx*inv_mass[b];vy[b]+=fy*inv_mass[b];omega[b]+=rtb*ti*inv_inertia[b];}result.c[6]++;}
static int contact_position(struct Manifold*m,uint32_t a,int32_t b){float depth=m->penetration-0.001f;if(depth<=0)return 0;float den=inv_mass[a]+(b>=0?inv_mass[b]:0);if(den<=0)return 0;float imp=(b<0?depth:(depth<0.05f?depth:0.05f))/den,ix=imp*m->nx,iy=imp*m->ny;x[a]-=ix*inv_mass[a];y[a]-=iy*inv_mass[a];if(b>=0){x[b]+=ix*inv_mass[b];y[b]+=iy*inv_mass[b];}return 1;}
static void joint_geometry(uint32_t j,struct JointGeometry*g){uint32_t a=joint_a[j],b=joint_b[j];float rax=local_ax[j]*cosine[a]+local_ay[j]*-sine[a],ray=local_ax[j]*sine[a]+local_ay[j]*cosine[a],rbx=local_bx[j]*cosine[b]+local_by[j]*-sine[b],rby=local_bx[j]*sine[b]+local_by[j]*cosine[b];float dx=(x[b]+rbx)-(x[a]+rax),dy=(y[b]+rby)-(y[a]+ray),len=sqrtf0(dx*dx+dy*dy);g->a=a;g->b=b;g->rax=rax;g->ray=ray;g->rbx=rbx;g->rby=rby;g->length=len;g->nx=len>0.000001f?dx/len:1;g->ny=len>0.000001f?dy/len:0;}
static void joint_velocity(uint32_t j,struct JointGeometry*g){joint_geometry(j,g);uint32_t a=g->a,b=g->b;float vax=vx[a]-omega[a]*g->ray,vay=vy[a]+omega[a]*g->rax,vbx=vx[b]-omega[b]*g->rby,vby=vy[b]+omega[b]*g->rbx,rna=cross(g->rax,g->ray,g->nx,g->ny),rnb=cross(g->rbx,g->rby,g->nx,g->ny);float den=inv_mass[a]+inv_mass[b]+rna*rna*inv_inertia[a]+rnb*rnb*inv_inertia[b];if(den<=0)return;float imp=-((vbx-vax)*g->nx+(vby-vay)*g->ny)/den,ix=imp*g->nx,iy=imp*g->ny;vx[a]-=ix*inv_mass[a];vy[a]-=iy*inv_mass[a];omega[a]-=rna*imp*inv_inertia[a];vx[b]+=ix*inv_mass[b];vy[b]+=iy*inv_mass[b];omega[b]+=rnb*imp*inv_inertia[b];result.c[8]++;}
static void joint_position(uint32_t j,struct JointGeometry*g){joint_geometry(j,g);uint32_t a=g->a,b=g->b;float den=inv_mass[a]+inv_mass[b];if(den<=0)return;float imp=clampf(g->length-joint_rest[j],-0.05f,0.05f)*joint_stiffness[j]/den,ix=imp*g->nx,iy=imp*g->ny;x[a]+=ix*inv_mass[a];y[a]+=iy*inv_mass[a];x[b]-=ix*inv_mass[b];y[b]-=iy*inv_mass[b];result.c[8]++;}
static void quantize_state(void){for(uint32_t i=0;i<BODIES;i++){x[i]=quantize(x[i]);y[i]=quantize(y[i]);angle[i]=quantize(wrap(angle[i]));vx[i]=quantize(vx[i]);vy[i]=quantize(vy[i]);omega[i]=quantize(omega[i]);}}
static void snapshot(uint32_t cp){uint32_t at=cp*STATE_VALUES;for(uint32_t i=0;i<BODIES;i++){result.checkpoints[at++]=x[i];result.checkpoints[at++]=y[i];result.checkpoints[at++]=angle[i];result.checkpoints[at++]=vx[i];result.checkpoints[at++]=vy[i];result.checkpoints[at++]=omega[i];}}
extern "C" __attribute__((visibility("default"))) int32_t run(uint32_t timesteps,uint32_t checkpoint_every){
 if(u32(8)!=2||u32(12)!=BODIES||u32(16)>JOINTS||timesteps==0||timesteps>1800||checkpoint_every==0||(timesteps+checkpoint_every-1)/checkpoint_every>MAX_CHECKPOINTS)return 1;
 uint32_t joint_count=u32(16),vel_iters=u32(24),pos_iters=u32(28),torque_steps=u32(68);float dt=f32(40),gravity=f32(44),restitution=f32(48),friction=f32(52),linear_damping=f32(60),angular_damping=f32(64);
 for(uint32_t i=0;i<16;i++)((uint32_t*)&result)[i]=0;
 for(uint32_t i=0;i<BODIES;i++){uint32_t o=HEADER_BYTES+i*BODY_WORDS*4;x[i]=f32(o);y[i]=f32(o+4);angle[i]=f32(o+8);vx[i]=f32(o+12);vy[i]=f32(o+16);omega[i]=f32(o+20);inv_mass[i]=f32(o+24);inv_inertia[i]=f32(o+28);half_x[i]=f32(o+32);half_y[i]=f32(o+36);torque[i]=f32(o+40);order[i]=i;}
 uint32_t jb=HEADER_BYTES+BODIES*BODY_WORDS*4;for(uint32_t j=0;j<joint_count;j++){uint32_t o=jb+j*JOINT_BYTES;joint_a[j]=u32(o);joint_b[j]=u32(o+4);local_ax[j]=f32(o+8);local_ay[j]=f32(o+12);local_bx[j]=f32(o+16);local_by[j]=f32(o+20);joint_rest[j]=f32(o+24);joint_stiffness[j]=f32(o+28);}
 struct Manifold m;struct JointGeometry g;uint32_t cp=0;
 for(uint32_t step=0;step<timesteps;step++){
  for(uint32_t i=0;i<BODIES;i++){vy[i]+=gravity*dt;if(step<torque_steps&&torque[i]!=0){omega[i]+=torque[i]*inv_inertia[i]*dt;result.c[9]++;}vx[i]*=linear_damping;vy[i]*=linear_damping;omega[i]*=angular_damping;x[i]+=vx[i]*dt;y[i]+=vy[i]*dt;angle[i]=wrap(angle[i]+omega[i]*dt);}quantize_state();
  uint32_t pairs=build_pairs();if(pairs==0xffffffffu)return 2;
  for(uint32_t it=0;it<vel_iters;it++){result.c[10]++;update_basis();for(uint32_t i=0;i<BODIES;i++)if(ground_manifold(i,&m)){result.c[3]++;result.c[4]++;contact_velocity(&m,i,-1,restitution,friction);}for(uint32_t p=0;p<pairs;p++){result.c[2]++;if(sat(pair_a[p],pair_b[p],&m)){result.c[3]++;result.c[4]++;contact_velocity(&m,pair_a[p],(int32_t)pair_b[p],restitution,friction);}}for(uint32_t j=0;j<joint_count;j++)joint_velocity(j,&g);quantize_state();}
  for(uint32_t it=0;it<pos_iters;it++){result.c[11]++;pairs=build_pairs();if(pairs==0xffffffffu)return 2;for(uint32_t i=0;i<BODIES;i++)if(ground_manifold(i,&m)){result.c[3]++;result.c[4]++;contact_position(&m,i,-1);}for(uint32_t p=0;p<pairs;p++){result.c[2]++;if(sat(pair_a[p],pair_b[p],&m)){result.c[3]++;result.c[4]++;contact_position(&m,pair_a[p],(int32_t)pair_b[p]);}}update_basis();for(uint32_t j=0;j<joint_count;j++)joint_position(j,&g);update_basis();for(uint32_t i=0;i<BODIES;i++)if(ground_manifold(i,&m)){result.c[3]++;result.c[4]++;contact_position(&m,i,-1);}quantize_state();}
  result.c[0]++;if((step+1)%checkpoint_every==0||step+1==timesteps)snapshot(cp++);
 }
 result.c[12]=cp*STATE_VALUES;return 0;
}
