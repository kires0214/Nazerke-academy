import {generateKeyPairSync} from 'node:crypto';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
export const syntheticMux={
  MUX_TOKEN_ID:'synthetic_mux_token_id',MUX_TOKEN_SECRET:'synthetic_mux_token_secret_only',
  MUX_WEBHOOK_SIGNING_SECRET:'synthetic_mux_webhook_secret_only',MUX_SIGNING_KEY_ID:'syntheticMuxKeyId',
  MUX_SIGNING_PRIVATE_KEY:Buffer.from(pair.privateKey.export({format:'pem',type:'pkcs8'})).toString('base64'),
};
export const syntheticPublicKey=pair.publicKey;
export function configureMux(){
  const before=Object.fromEntries(Object.keys(syntheticMux).map(key=>[key,process.env[key]]));
  Object.assign(process.env,syntheticMux);
  return ()=>{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}};
}
