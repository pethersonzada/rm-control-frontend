import {createContext,useContext,useEffect,useState,type ReactNode} from "react";

type Preference="system"|"light"|"dark";
const storageKey="rm-control-theme";
const media=window.matchMedia("(prefers-color-scheme: dark)");
function read():Preference{
  try{const saved=localStorage.getItem(storageKey);if(saved==="light"||saved==="dark"||saved==="system")return saved;}catch{}
  return "system";
}
function apply(value:Preference){
  const resolved=value==="system"?(media.matches?"dark":"light"):value;
  document.documentElement.dataset.theme=resolved;
  document.documentElement.style.colorScheme=resolved;
}
apply(read());
const ThemeContext=createContext<{preference:Preference;setPreference:(value:Preference)=>void}>({preference:"system",setPreference:()=>{}});
export function ThemeProvider({children}:{children:ReactNode}){
  const [preference,setPreference]=useState(read);
  useEffect(()=>{
    const change=()=>apply(preference);
    change();media.addEventListener("change",change);
    try{localStorage.setItem(storageKey,preference);}catch{}
    return()=>media.removeEventListener("change",change);
  },[preference]);
  return <ThemeContext.Provider value={{preference,setPreference}}>{children}</ThemeContext.Provider>;
}
export function ThemeControl(){
  const {preference,setPreference}=useContext(ThemeContext);
  return <label className="theme-control"><span>Tema</span><select aria-label="Tema da interface" value={preference} onChange={e=>setPreference(e.target.value as Preference)}><option value="system">Automático</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>;
}
export function BrandLogo({className=""}:{className?:string}){
  return <span className={"brand-image "+className}><img className="logo-light" src="/logo-mono-com-nome.png" alt="RM Control"/><img className="logo-dark" src="/logo-color-com-nome.png" alt="RM Control"/></span>;
}
