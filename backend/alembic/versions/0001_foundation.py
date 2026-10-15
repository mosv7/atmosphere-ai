"""Initial persistent environmental and model schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("cities", sa.Column("id", sa.String(100), primary_key=True), sa.Column("name", sa.String(150), nullable=False), sa.Column("country", sa.String(150), nullable=False), sa.Column("administrative_region", sa.String(200)), sa.Column("latitude", sa.Float(), nullable=False), sa.Column("longitude", sa.Float(), nullable=False), sa.Column("timezone", sa.String(100), nullable=False))
    for name, fields, source_type in [("air_quality_observations", ["pm25", "pm10", "no2", "o3", "so2", "co"], True), ("weather_observations", ["temperature", "humidity", "wind_speed", "wind_direction", "precipitation", "pressure"], False)]:
        short = "aq" if source_type else "weather"
        columns = [sa.Column("id", sa.Integer(), primary_key=True), sa.Column("city_id", sa.String(100), sa.ForeignKey("cities.id"), nullable=False), sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False), *[sa.Column(field, sa.Float()) for field in fields], sa.Column("source", sa.String(100), nullable=False), sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False)]
        if source_type:
            columns.append(sa.Column("source_type", sa.String(100), nullable=False))
        op.create_table(name, *columns, sa.UniqueConstraint("city_id", "timestamp", "source", name=f"uq_{short}_city_time_source"))
        op.create_index(f"ix_{short}_city_time", name, ["city_id", "timestamp"])
    op.create_table("model_registry", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("version", sa.String(150), unique=True, nullable=False), sa.Column("model_name", sa.String(100), nullable=False), sa.Column("training_date", sa.DateTime(timezone=True), nullable=False), sa.Column("feature_schema", sa.JSON(), nullable=False), sa.Column("evaluation_metrics", sa.JSON(), nullable=False), sa.Column("artifact_path", sa.Text(), nullable=False), sa.Column("metadata_json", sa.JSON(), nullable=False), sa.Column("active", sa.Boolean(), nullable=False))
    op.create_table("forecast_runs", sa.Column("id", sa.String(36), primary_key=True), sa.Column("city_id", sa.String(100), sa.ForeignKey("cities.id"), nullable=False), sa.Column("model_version", sa.String(150), nullable=False), sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False), sa.Column("source_data_timestamp", sa.DateTime(timezone=True), nullable=False), sa.Column("status", sa.String(30), nullable=False), sa.Column("response_json", sa.JSON(), nullable=False))
    op.create_index("ix_forecast_runs_city_id", "forecast_runs", ["city_id"])
    op.create_index("ix_forecast_runs_issued_at", "forecast_runs", ["issued_at"])
    op.create_table("forecast_values", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("forecast_run_id", sa.String(36), sa.ForeignKey("forecast_runs.id", ondelete="CASCADE"), nullable=False), sa.Column("target_timestamp", sa.DateTime(timezone=True), nullable=False), sa.Column("horizon_hours", sa.Integer(), nullable=False), sa.Column("predicted_pm25", sa.Float(), nullable=False), sa.Column("lower_bound", sa.Float()), sa.Column("upper_bound", sa.Float()), sa.UniqueConstraint("forecast_run_id", "horizon_hours", name="uq_forecast_horizon"))
    op.create_index("ix_forecast_values_forecast_run_id", "forecast_values", ["forecast_run_id"])
    op.create_table("ingestion_jobs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("city_id", sa.String(100), sa.ForeignKey("cities.id")), sa.Column("source", sa.String(100), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("status", sa.String(30), nullable=False), sa.Column("records_processed", sa.Integer(), nullable=False), sa.Column("error_message", sa.Text()))


def downgrade():
    for table in ["ingestion_jobs", "forecast_values", "forecast_runs", "model_registry", "weather_observations", "air_quality_observations", "cities"]:
        op.drop_table(table)
