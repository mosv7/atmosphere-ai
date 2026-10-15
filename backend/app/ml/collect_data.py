"""Collect real source data into PostgreSQL. No synthetic fallback."""
import argparse
import asyncio
from datetime import UTC, datetime, timedelta
import json


async def collect(days=180, city_ids=None, include_weather=True):
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.models import City
    from app.services.ingestion import ingest_city, seed_cities
    results = []
    with SessionLocal() as db:
        seed_cities(db)
        cities = db.scalars(select(City).order_by(City.id)).all()
        if city_ids:
            cities = [city for city in cities if city.id in city_ids]
            unknown = set(city_ids) - {city.id for city in cities}
            if unknown:
                raise ValueError(f'Unknown stored city ids: {sorted(unknown)}')
        end = datetime.now(UTC).date()
        start = end - timedelta(days=days-1)
        for city in cities:
            print(f'Collecting {city.name}: {start} to {end}', flush=True)
            result = await ingest_city(db, city, days=days, start_date=start, end_date=end, include_weather=include_weather)
            results.append({'city_id': city.id, 'result': result})
            print(json.dumps(results[-1], default=str), flush=True)
            await asyncio.sleep(.5)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--days', type=int, default=180)
    parser.add_argument('--cities', nargs='+')
    parser.add_argument('--no-weather', action='store_true')
    args = parser.parse_args()
    if not 14 <= args.days <= 1095:
        parser.error('--days must be 14..1095; actual source availability is checked by ingestion')
    asyncio.run(collect(args.days, args.cities, not args.no_weather))


if __name__ == '__main__':
    main()
