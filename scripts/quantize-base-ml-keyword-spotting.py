import argparse, json
import numpy as np
parser=argparse.ArgumentParser()
parser.add_argument('--features',required=True)
parser.add_argument('--labels',required=True)
parser.add_argument('--model',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
if np.__version__ != '2.4.3': raise RuntimeError('requires NumPy 2.4.3')
p=dict(np.load(args.model))
raw=np.fromfile(args.features,dtype=np.int8).astype(np.float32).reshape(-1,49,10); y=np.fromfile(args.labels,dtype=np.uint8)
train=np.concatenate([np.where(y==c)[0][:-80] for c in range(12)]); val=np.concatenate([np.where(y==c)[0][-80:] for c in range(12)])
mean=raw[train].mean((0,1));std=raw[train].std((0,1));x=(raw-mean)/std

def conv(x,w,b,stride=1,pad=(0,0,0,0),groups=False):
 # x N,H,W,C; w O,I,Hk,Wk or O,1,Hk,Wk
 l,r,t,bo=pad;x=np.pad(x,((0,0),(t,bo),(l,r),(0,0))); kh,kw=w.shape[2:]; win=np.lib.stride_tricks.sliding_window_view(x,(kh,kw),axis=(1,2))[:,::stride,::stride] # N,OH,OW,C,kh,kw
 if groups:
  # w C,1,kh,kw
  out=np.einsum('nhwckl,ckl->nhwc',win,w[:,0],optimize=True)
 else: out=np.einsum('nhwikl,oikl->nhwo',win,w,optimize=True)
 return out+b

def fwd(x):
 a=np.maximum(conv(x[...,None],p['conv0.weight'],p['conv0.bias'],2,(1,2,4,5)),0); outs=[a]
 for i in range(4):
  a=conv(a,p[f'dw{i}.weight'],p[f'dw{i}.bias'],1,(1,1,1,1),True)
  a=np.maximum(conv(a,p[f'pw{i}.weight'],p[f'pw{i}.bias']),0);outs.append(a)
 z=a.mean((1,2))@p['dense.weight'].T+p['dense.bias'];return outs,z
outs,z=fwd(x[train]); float_train=float((z.argmax(1)==y[train]).mean()); print('float',float_train)
_,zv=fwd(x[val]);float_val=float((zv.argmax(1)==y[val]).mean());print('floatval',float_val)
act_scales=[o.max()/127 for o in outs]; print('scales',act_scales)
# quantize config
layers=[]; input_scale=1/16
names=['conv0']+[q for i in range(4) for q in (f'dw{i}',f'pw{i}')]
# outputs only conv0 and each pw; depthwise gets scale selected by its float output abs max /127 separately
# gather all layer float scales properly
# recompute intermediate max sequence
A=x[train][...,None]; output_scales=[]
A=np.maximum(conv(A,p['conv0.weight'],p['conv0.bias'],2,(1,2,4,5)),0);output_scales.append(A.max()/127)
for i in range(4):
 A=conv(A,p[f'dw{i}.weight'],p[f'dw{i}.bias'],1,(1,1,1,1),True);output_scales.append(max(abs(A.min()),abs(A.max()))/127)
 A=np.maximum(conv(A,p[f'pw{i}.weight'],p[f'pw{i}.bias']),0);output_scales.append(A.max()/127)
print('all scales',output_scales)

def rq(acc,m):
 mq=int(round(m*(1<<24))); v=acc.astype(np.int64)*mq; return np.where(v>=0,(v+(1<<23))>>24,-((-v+(1<<23))>>24)),mq
qi=np.clip(np.rint(x[train]*16),-128,127).astype(np.int8)[...,None]; ai=qi; in_scale=input_scale; configs=[]; si=0
for name in names:
 w=p[name+'.weight'];b=p[name+'.bias'];ws=max(abs(w.min()),abs(w.max()))/127; wi=np.clip(np.rint(w/ws),-127,127).astype(np.int8); bi=np.rint(b/(in_scale*ws)).astype(np.int32); out_scale=output_scales[si];si+=1
 if name=='conv0': acc=conv(ai.astype(np.int32),wi.astype(np.int32),bi,2,(1,2,4,5))
 elif name.startswith('dw'): acc=conv(ai.astype(np.int32),wi.astype(np.int32),bi,1,(1,1,1,1),True)
 else: acc=conv(ai.astype(np.int32),wi.astype(np.int32),bi)
 out,mq=rq(acc,in_scale*ws/out_scale); ai=np.clip(out,0 if not name.startswith('dw') else -128,127).astype(np.int8)
 configs.append({'name':name,'weightScale':float(ws),'inputScale':float(in_scale),'outputScale':float(out_scale),'multiplierQ24':mq,'weights':wi.reshape(-1).astype(int).tolist(),'biases':bi.astype(int).tolist()});in_scale=out_scale
# dense after global average integer: avg rounding then dense acc
pooled=np.rint(ai.astype(np.int32).mean((1,2))).astype(np.int8);w=p['dense.weight'];b=p['dense.bias'];ws=max(abs(w.min()),abs(w.max()))/127;wi=np.clip(np.rint(w/ws),-127,127).astype(np.int8);bi=np.rint(b/(in_scale*ws)).astype(np.int32);scores=pooled.astype(np.int32)@wi.T.astype(np.int32)+bi
quant_train=float((scores.argmax(1)==y[train]).mean())
print('quant train',quant_train)
configs.append({'name':'dense','weightScale':float(ws),'inputScale':float(in_scale),'outputScale':None,'multiplierQ24':None,'weights':wi.reshape(-1).astype(int).tolist(),'biases':bi.astype(int).tolist()})
# Run the closed quantized graph on validation data with the frozen configs.
def qforward(source):
 ai=np.clip(np.rint(x[source]*16),-128,127).astype(np.int8)[...,None]
 for cfg in configs[:-1]:
  wi=np.array(cfg['weights'],dtype=np.int8)
  if cfg['name']=='conv0': wi=wi.reshape(8,1,10,4);acc=conv(ai.astype(np.int32),wi.astype(np.int32),np.array(cfg['biases']),2,(1,2,4,5))
  elif cfg['name'].startswith('dw'): wi=wi.reshape(8,1,3,3);acc=conv(ai.astype(np.int32),wi.astype(np.int32),np.array(cfg['biases']),1,(1,1,1,1),True)
  else: wi=wi.reshape(8,8,1,1);acc=conv(ai.astype(np.int32),wi.astype(np.int32),np.array(cfg['biases']))
  v=acc.astype(np.int64)*cfg['multiplierQ24'];out=np.where(v>=0,(v+(1<<23))>>24,-((-v+(1<<23))>>24));ai=np.clip(out,0 if not cfg['name'].startswith('dw') else -128,127).astype(np.int8)
 pooled=np.where(ai.astype(np.int32).sum((1,2))>=0,(ai.astype(np.int32).sum((1,2))+62)//125,-((-ai.astype(np.int32).sum((1,2))+62)//125))
 d=configs[-1];wi=np.array(d['weights'],dtype=np.int8).reshape(12,8);return pooled@wi.T+np.array(d['biases'])
qv=qforward(val);quant_val=float((qv.argmax(1)==y[val]).mean());print('quant val',quant_val)
# Frozen lookup makes preprocessing normalization integer-exact in JS and C.
norm=[]
for k in range(10): norm.append([int(np.clip(np.rint((raw_value-mean[k])/std[k]*16),-128,127)) for raw_value in range(-128,128)])
out={'schemaVersion':2,'licenseSpdx':'MIT','architecture':'49x10 Conv2D(8,10x4,stride2) plus four DepthwiseConv2D(3x3)/PointwiseConv2D(1x1) blocks, global average, Dense(12)','training':{'dataset':'Speech Commands v2 published test archive','archiveSha256':'cc2a00c1147c2254e9be3fa0f779d8c17421dc349b86366567a8edfa9acd51df','split':'byte-sorted last 80 files per label held out','python':'3.13.5','numpy':'2.4.3','tinygrad':'0.11.0'},'trainingSeed':'0x4b575332','labels':['down','go','left','no','off','on','right','stop','up','yes','silence','unknown'],'featureMean':mean.tolist(),'featureStd':std.tolist(),'featureQuantScale':16,'layers':configs,'accuracy':{'trainingExamples':len(train),'validationExamples':len(val),'floatTraining':float_train,'floatValidation':float_val,'quantizedTraining':quant_train,'quantizedValidation':quant_val},'normalizationLookupI8':norm}
open(args.output,'w').write(json.dumps(out,separators=(',',':'))+'\n')
