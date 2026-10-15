from alembic import context
from sqlalchemy import create_engine, pool
from app.core.config import get_settings
from app.db.session import Base
import app.models

config = context.config
target_metadata = Base.metadata
if context.is_offline_mode():
    context.configure(url=get_settings().database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(get_settings().database_url, poolclass=pool.NullPool, connect_args={"connect_timeout": 10} if get_settings().database_url.startswith("postgresql") else {})
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
