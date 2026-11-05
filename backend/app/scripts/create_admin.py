"""Create (or reset the password of) an administrator account from the command line.

There is deliberately no public registration endpoint. Run this on the server:

    python -m app.scripts.create_admin --email you@example.com --name "Your Name"
    python -m app.scripts.create_admin --email you@example.com --reset   # change password

The password is prompted for interactively (or read from ADMIN_PASSWORD for automation).
"""

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import AdminUser
from app.schemas.auth import validate_password_strength
from app.services.auth import revoke_all_for_user


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Administrator")
    parser.add_argument("--reset", action="store_true", help="Reset the password of an existing admin")
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Confirm password: "):
            sys.exit("Passwords do not match.")
    try:
        validate_password_strength(password)
    except ValueError as exc:
        sys.exit(str(exc))

    email = args.email.lower().strip()
    with SessionLocal() as db:
        user = db.scalars(select(AdminUser).where(AdminUser.email == email)).first()
        if user and not args.reset:
            sys.exit(f"An admin with {email} already exists. Use --reset to change its password.")
        if not user and args.reset:
            sys.exit(f"No admin with {email} exists.")
        if user:
            user.password_hash = hash_password(password)
            revoke_all_for_user(db, user.id)
            action = "Password reset"
        else:
            db.add(AdminUser(email=email, full_name=args.name, password_hash=hash_password(password), role="admin"))
            action = "Admin created"
        db.commit()
    print(f"{action} for {email}.")


if __name__ == "__main__":
    main()
