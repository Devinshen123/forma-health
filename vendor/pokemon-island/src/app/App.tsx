import { EcologyScene } from '../components/EcologyScene';

export function App() {
  const dex=Number(new URLSearchParams(location.search).get('companion'));
  const companionId=Number.isInteger(dex)&&dex>=1&&dex<=151?String(dex).padStart(3,'0'):undefined;
  const onBack=()=>{
    if(window.parent!==window)window.parent.postMessage({type:'forma-island-close'},location.origin);
    else location.assign('/');
  };
  return <EcologyScene assetBase={import.meta.env.BASE_URL} companionId={companionId} onBack={onBack}/>;
}
