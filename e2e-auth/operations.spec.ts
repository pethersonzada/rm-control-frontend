import {expect,test} from "@playwright/test";

test("registra fornecedores, corrige, cancela, exporta e configura referências",async({page})=>{
  const now=Math.floor(Date.now()/1000);
  const token="eyJhbGciOiJSUzI1NiJ9."+Buffer.from(JSON.stringify({sub:"qa-uid",iat:now,exp:now+3600})).toString("base64url")+".synthetic";
  const account={localId:"qa-uid",email:"owner@example.invalid",emailVerified:true};
  type Row={id:number;store:string;supplier_name:string;checker:string;checked_at:string;active:boolean;revision:number;created_by:string;[key:string]:unknown};
  const rows:Row[]=[];
  const history:Array<Record<string,unknown>>=[];
  let policy={enabled:false,days:0,start_field:"received_at",timezone:"America/Recife",holidays:[],reference:"",revision:0};
  const units:Array<Record<string,unknown>>=[];
  let financial={approved:null,recovered:null,pending:null,reference:"",revision:0};
  const record={code:"90001",origin:"CD QA",destination:"2",load:"1",reason:"FALTA",status:"PENDENTE",items:[]};
  await page.route("https://identitytoolkit.googleapis.com/**",route=>{
    if(route.request().url().includes("signInWithPassword"))return route.fulfill({json:{...account,idToken:token,refreshToken:"qa-refresh",expiresIn:"3600"}});
    if(route.request().url().includes("accounts:lookup"))return route.fulfill({json:{users:[account]}});
    return route.abort();
  });
  await page.route("**/api/**",route=>{
    const url=new URL(route.request().url()),path=url.pathname.replace("/api",""),method=route.request().method();
    expect(route.request().headers().authorization).toBeDefined();
    if(path==="/me")return route.fulfill({json:{subject:"qa",organization:"qa",role:"admin",stores:["2"],can_delegate_admin:true}});
    if(path==="/summary")return route.fulfill({json:{occurrences:1,items_without_value:0,status_counts:{PENDENTE:1},totals_by_reason:{FALTA:"0"},net_reported:"0",approved:financial.approved,recovered:financial.recovered,pending:financial.pending,note:"Sintético"}});
    if(path==="/stores")return route.fulfill({json:[{code:"2",name:"Loja QA",active:true}]});
    if(path==="/supplier-checks"&&method==="POST"){
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      const row={...route.request().postDataJSON(),id:rows.length+1,active:true,revision:1,created_by:"qa"} as Row;
      rows.push(row);history.unshift({action:"create",actor:"qa",reason:null,current:row,previous:null,created_at:row.checked_at});return route.fulfill({json:row});
    }
    if(path==="/supplier-checks"&&method==="GET"){
      const selected=rows.filter(r=>url.searchParams.get("include_cancelled")==="true"||r.active).filter(r=>!url.searchParams.get("checker")||r.checker.includes(url.searchParams.get("checker")!));
      return route.fulfill({json:{records:selected,next_cursor:null,completed:selected.filter(r=>r.active).length,cancelled:selected.filter(r=>!r.active).length}});
    }
    if(path==="/supplier-checks/1"&&method==="PUT"){
      const data=route.request().postDataJSON(),previous={...rows[0]};
      expect(data.revision).toBe(previous.revision);expect(data.change_reason).toBeTruthy();
      rows[0]={...rows[0],...data,revision:data.revision+1};
      history.unshift({action:data.active?"edit":"cancel",actor:"qa",reason:data.change_reason,current:rows[0],previous,created_at:rows[0].checked_at});
      return route.fulfill({json:rows[0]});
    }
    if(path==="/supplier-checks/1/history")return route.fulfill({json:{events:history,next_cursor:null}});
    if(path==="/reports/fornecedores.xlsx")return route.fulfill({body:Buffer.from("synthetic-workbook"),contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    if(path==="/admin/policy"){if(method==="PUT"){const data=route.request().postDataJSON();policy={...data,revision:data.revision+1};}return route.fulfill({json:policy});}
    if(path==="/admin/units"){if(method==="PUT"){const data=route.request().postDataJSON();units.push({...data,revision:1});return route.fulfill({json:units.at(-1)});}return route.fulfill({json:units});}
    if(path==="/admin/diagnostics")return route.fulfill({json:{uptime_seconds:10,requests:20,server_errors:0,client_errors:0,rate_limited:0,slow_requests:0,mean_duration_ms:12,scope:"process-local"}});
    if(path==="/occurrences")return route.fulfill({json:{records:[record],next_cursor:null}});
    if(path.endsWith("/finance")){if(method==="PUT"){const data=route.request().postDataJSON();financial={...data,revision:data.revision+1};}return route.fulfill({json:financial});}
    if(path.endsWith("/history"))return route.fulfill({json:{events:[],next_cursor:null}});
    return route.fulfill({status:404,json:{detail:"Rota sintética não encontrada"}});
  });
  await page.goto("/");
  await page.getByLabel("E-mail",{exact:true}).fill(account.email);
  await page.getByLabel("Senha",{exact:true}).fill("senha-sintetica");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await page.getByRole("link",{name:"Fornecedores conferidos"}).click();
  await page.getByLabel("Código do fornecedor").fill("00042");
  await page.getByLabel("Fornecedor",{exact:true}).fill("Fornecedor QA");
  await page.getByLabel("Conferente",{exact:true}).fill("Conferente A");
  await page.getByRole("button",{name:"Registrar conferência"}).click();
  await expect(page.getByText("Conferência registrada.",{exact:true})).toBeVisible();
  await expect(page.getByRole("cell",{name:"Conferente A",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Corrigir 1"}).click();
  await page.getByLabel("Conferente",{exact:true}).fill("Conferente B");
  await page.getByLabel("Motivo da alteração").fill("Correção QA");
  await page.getByRole("button",{name:"Salvar alteração"}).click();
  await expect(page.getByRole("cell",{name:"Conferente B",exact:true})).toBeVisible();
  await page.getByLabel("Filtrar conferente").fill("Conferente B");
  await page.getByRole("button",{name:"Aplicar filtros"}).click();
  await page.getByRole("button",{name:"Histórico 1"}).click();
  await expect(page.getByText("Motivo: Correção QA")).toBeVisible();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Gerar Excel de fornecedores"}).click();
  expect((await download).suggestedFilename()).toBe("rm-control-fornecedores.xlsx");
  await page.getByRole("button",{name:"Corrigir 1"}).click();
  await page.getByLabel("Motivo da alteração").fill("Cancelamento QA");
  await page.getByLabel("Cancelar conferência").check();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Salvar alteração"}).click();
  await expect(page.getByText("Nenhuma conferência encontrada.")).toBeVisible();
  await page.getByLabel("Incluir canceladas").check();
  await page.getByRole("button",{name:"Aplicar filtros"}).click();
  await expect(page.getByRole("cell",{name:"Cancelado",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Configurações",exact:true}).click();
  await page.getByLabel("Ativar cálculo de prazo").check();
  await page.getByLabel("Dias úteis").fill("3");
  await page.getByLabel("Referência da regra validada").fill("Regra QA");
  await page.getByRole("button",{name:"Salvar configuração"}).click();
  await expect(page.getByText("Configuração salva.",{exact:true})).toBeVisible();
  await page.getByLabel("PLU da referência").fill("00042");
  await page.getByRole("button",{name:"Consultar referências"}).click();
  await page.getByLabel("Embalagem",{exact:true}).fill("CX");
  await page.getByLabel("Unidade base").fill("UN");
  await page.getByLabel("Fator por embalagem").fill("12");
  await page.getByLabel("Fonte conferida").fill("Embalagem QA");
  await page.getByRole("button",{name:"Salvar referência"}).click();
  await expect(page.getByText("Referência registrada.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Consultar diagnóstico"}).click();
  await expect(page.getByText("Requisições lentas",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Chamados",exact:true}).click();
  await page.getByRole("button",{name:"90001",exact:true}).click();
  await page.getByRole("button",{name:"Conferência financeira",exact:true}).click();
  await page.getByLabel("Aprovado (R$)").fill("12,34");
  await page.getByLabel("Referência da conferência financeira").fill("Evidência QA");
  await page.getByRole("button",{name:"Salvar valores conferidos"}).click();
  await expect(page.getByText("Valores conferidos registrados.",{exact:true})).toBeVisible();
});
