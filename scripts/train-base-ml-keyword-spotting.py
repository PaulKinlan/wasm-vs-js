import argparse, os, random
os.environ.setdefault('CPU', '1')
import numpy as np
from importlib.metadata import version
from tinygrad import Tensor, nn
from tinygrad.nn.state import get_parameters
parser=argparse.ArgumentParser()
parser.add_argument('--features',required=True)
parser.add_argument('--labels',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
if np.__version__ != '2.4.3' or version('tinygrad') != '0.11.0': raise RuntimeError('requires NumPy 2.4.3 and tinygrad 0.11.0')
random.seed(0x4b575332); np.random.seed(0x4b575332); Tensor.manual_seed(0x4b575332)
X=np.fromfile(args.features,dtype=np.int8).astype(np.float32).reshape(-1,49,10)
y=np.fromfile(args.labels,dtype=np.uint8).astype(np.int32)
train=np.concatenate([np.where(y==c)[0][:-80] for c in range(12)]); val=np.concatenate([np.where(y==c)[0][-80:] for c in range(12)])
mean=X[train].mean((0,1),keepdims=True); std=X[train].std((0,1),keepdims=True); X=(X-mean)/std
print('norm',mean.ravel().tolist(),std.ravel().tolist(),len(train),len(val))
class Model:
 def __init__(self):
  self.c0=nn.Conv2d(1,8,(10,4),stride=2,padding=0,bias=True)
  self.dw=[nn.Conv2d(8,8,3,padding=1,groups=8,bias=True) for _ in range(4)]
  self.pw=[nn.Conv2d(8,8,1,bias=True) for _ in range(4)]
  self.fc=nn.Linear(8,12)
 def __call__(self,x):
  x=self.c0(x.pad((None,None,(4,5),(1,2)))).relu()
  for d,p in zip(self.dw,self.pw): x=p(d(x)).relu()
  return self.fc(x.mean(axis=(2,3)))
m=Model(); opt=nn.optim.Adam(get_parameters(m),lr=0.003)
def acc(ids):
 z=m(Tensor(X[ids,None,:,:])).numpy(); return (z.argmax(1)==y[ids]).mean()
with Tensor.train():
 for ep in range(61):
  ids=train.copy();np.random.shuffle(ids)
  losses=[]
  for s in range(0,len(ids),64):
   bi=ids[s:s+64]; z=m(Tensor(X[bi,None,:,:])); loss=z.sparse_categorical_crossentropy(Tensor(y[bi]));opt.zero_grad();loss.backward();opt.step();losses.append(loss.item())
  if ep%10==0: print(ep,np.mean(losses),acc(train),acc(val),flush=True)
# save float params ordered named manually
arrays={}
arrays['conv0.weight']=m.c0.weight.numpy();arrays['conv0.bias']=m.c0.bias.numpy()
for i in range(4):
 arrays[f'dw{i}.weight']=m.dw[i].weight.numpy();arrays[f'dw{i}.bias']=m.dw[i].bias.numpy();arrays[f'pw{i}.weight']=m.pw[i].weight.numpy();arrays[f'pw{i}.bias']=m.pw[i].bias.numpy()
arrays['dense.weight']=m.fc.weight.numpy();arrays['dense.bias']=m.fc.bias.numpy()
np.savez(args.output,**arrays)
print('final',acc(train),acc(val))
