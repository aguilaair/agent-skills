"""Re-derive every Cognito entry's links (vendor, mine, farm, reporting months) with the app's own resolver.

A worktree database copied from an older snapshot can hold entries ingested before a link
rule existed, so the screens that read those links come up empty. Run it inside the
worktree, from api/:

    cd <worktree>/api && PYTHONPATH=$PWD direnv exec .. uv run python <skill>/scripts/relink_cognito.py

Manual links keep their vendor/mine/farm; only reporting months are refreshed on them.
"""

from sqlalchemy import select

from api.ingestion.cognito_links import relink
from pyterra.daos.vendor import VendorDAO
from pyterra.database.database import SessionLocal
from pyterra.database.models.cognito_entries import CognitoEntry

db = SessionLocal()
VendorDAO(db).lock()
entries = db.execute(select(CognitoEntry)).scalars().all()
print("changed", relink(db, entries))
db.commit()
