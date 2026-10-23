# Places dataset validation status

Validated `places.csv` as a read-only dataset check. No structural CSV error was found, so `places.csv` was not changed.

## Summary

| Check | Result |
| --- | ---: |
| Data rows | 50 |
| Cities | 10 |
| Categories | 9 |
| Required columns | 12 of 12, exact order and spelling |
| Duplicate `place_id` values | 0 |
| Duplicate place names within the same city | 0 |
| Malformed data rows | 0 |
| Invalid populated numeric values | 0 |
| Inconsistent category values | 0 |
| Inconsistent `indoor_outdoor` values | 0 |
| Inconsistent suitability/season values | 0 |

## Missing values by column

| Column | Missing values |
| --- | ---: |
| `place_id` | 0 |
| `place_name` | 0 |
| `city` | 0 |
| `category` | 0 |
| `entry_fee` | 50 |
| `estimated_visit_hours` | 50 |
| `average_rating` | 50 |
| `rating_count` | 50 |
| `indoor_outdoor` | 0 |
| `rain_suitability` | 0 |
| `heat_suitability` | 0 |
| `best_season` | 0 |

`Unknown` appears in every `rain_suitability`, `heat_suitability`, and `best_season` value. It is a deliberate unknown-data marker, not a blank cell or a malformed categorical value.

## Controlled values found

- Categories: `Adventure`, `Beach`, `Cultural`, `Entertainment`, `Food`, `Historical`, `Nature`, `Religious`, `Shopping`
- Cities: `Bangalore`, `Chennai`, `Hyderabad`, `Jaipur`, `Kolkata`, `Mumbai`, `Nashik`, `New Delhi`, `Surat`, `Vadodara`
- `indoor_outdoor`: `Indoor`, `Mixed`, `Outdoor`
- `rain_suitability`: `Unknown`
- `heat_suitability`: `Unknown`
- `best_season`: `Unknown`

## Reliable data needed before ML training

Obtain reliable, source-backed data for each place before training recommendations with these attributes:

- `entry_fee`
- `estimated_visit_hours`
- `average_rating`
- `rating_count`
- `rain_suitability`
- `heat_suitability`
- `best_season`

Training labels and any model-related data are intentionally out of scope for this dataset validation step.
