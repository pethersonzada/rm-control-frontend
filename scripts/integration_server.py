"""CI-only API harness: real PostgreSQL and signed synthetic JWTs; never deploy."""
import base64
import json
import os
from pathlib import Path
from random import Random
import sys
import time
from datetime import datetime,timedelta,timezone

from alembic import command
from alembic.config import Config
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from google.auth import crypt
from openpyxl import Workbook
from sqlalchemy.engine import make_url
import uvicorn

url=os.environ["DATABASE_URL"]
parsed=make_url(url)
if os.getenv("CI")!="true" or os.getenv("RM_MODE")!="local" or parsed.host not in {"127.0.0.1","localhost"} or not (parsed.database or "").endswith("_test"):
    raise SystemExit("Use somente PostgreSQL descartável local de CI.")
if os.getenv("RM_FIREBASE_PROJECT_ID")!="rm-control-test":
    raise SystemExit("Projeto de identidade exclusivamente sintético obrigatório.")
backend=Path(os.environ["RM_BACKEND_DIR"]).resolve()
out=Path(os.environ["RM_INTEGRATION_FIXTURES"]).resolve()
out.mkdir(parents=True,exist_ok=True)
os.chdir(backend)
sys.path.insert(0,str(backend))
from app import firebase_auth
from app.database import connect
from app.services.memberships import bootstrap
from app.main import create_app

command.upgrade(Config("alembic.ini"),"head")
engine=connect(url)
project="rm-control-test"
bootstrap(engine,project,"integration-qa","qa-owner",{"2"})
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
now=datetime.now(timezone.utc)
name=x509.Name([x509.NameAttribute(x509.NameOID.COMMON_NAME,"rm-ci-synthetic")])
cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
      .serial_number(1).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=1)).sign(key,hashes.SHA256()))
signer=crypt.RSASigner.from_string(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()),key_id="qa")
firebase_auth.certificates=lambda:{"qa":cert.public_bytes(serialization.Encoding.PEM)}
timestamp=int(time.time())
def issue(uid):
    return firebase_auth.jwt.encode(signer,{"sub":uid,"user_id":uid,"iss":f"https://securetoken.google.com/{project}","aud":project,"auth_time":timestamp-2,"iat":timestamp-1,"exp":timestamp+3600}).decode()
(out/"tokens.json").write_text(json.dumps({"owner":issue("qa-owner"),"operator":issue("qa-operator")}))
book=Workbook(write_only=True)
sheet=book.create_sheet("Sintética")
sheet.append(["DATA RECEBIMENTO","LOJA","PLU","N° CHAMADO","TIPO DA DIVERGÊNCIA","QTD DIVERGENTE","VALOR DA DIVERGÊNCIA","VOLUME","Volume sintético"])
random=Random(901)
for index in range(9300):
    sheet.append(["08/01/2026","7",10000+index,90000+index//50,"FALTA",1,"12,34","CX-12",base64.b64encode(random.randbytes(1750)).decode()])
book.save(out/"historico.xlsx")
size=(out/"historico.xlsx").stat().st_size
assert 14_000_000<size<20_000_000
print(f"Fixture sintética: {size} bytes, 9300 linhas",flush=True)
uvicorn.run(create_app(engine=engine),host="127.0.0.1",port=8001,access_log=False)
