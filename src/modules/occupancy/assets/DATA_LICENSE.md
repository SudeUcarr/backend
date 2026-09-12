KampüsKit integration: web/public/ml paths in the original notice below correspond to src/modules/occupancy/assets. Training artifacts are under ml/artifacts. Models and derived data retain the same CC BY-SA 4.0 attribution and license.

# Dataset attribution and license

**COD: A Dataset of Commercial Building Occupancy Traces** (2017), Kin Sum Liu, Elvin Vindel Pinto, Sirajum Munir, Jonathan Francis, Charles Shelton, Mario Bergés, and Shan Lin.

Source: https://doi.org/10.5281/zenodo.996587

The Zenodo record declares **Creative Commons Attribution-ShareAlike 4.0 International**: https://creativecommons.org/licenses/by-sa/4.0/

The original archive is retained as `data/raw/COD.zip`. Changes: select Main Entrance; derive positive entrance changes; create 15-minute snapshots; construct entry/time features; split chronologically; add model predictions. No endorsement by the authors is implied.

Derived dataset files (`artifacts/prepared.csv`, `artifacts/test_predictions.csv`, `web/public/ml/demo.json`) are distributed under CC BY-SA 4.0 with this attribution. Model exports are provided with the same attribution and license. Retain this notice with redistributed data/model files.

The same attribution and CC BY-SA 4.0 terms also apply to the added 60-minute forecast derivatives: `artifacts/forecast_test_predictions.csv`, `web/public/ml/forecast.json`, `artifacts/forecast_60.joblib`, and `web/public/ml/forecast-forest.json`. Their targets pair each origin timestamp with the sensor count exactly one hour later, within the same recorded day. No exam-week or university-specific training data was added.

University capacity facts in `capacities.json` are separately attributed to official URLs. They are not part of COD. University documents are not republished in this package.

The inspected, unused Chapel Hill 2020 archive is attributed to the Town of Chapel Hill; its catalog identifies ODbL: https://opendatacommons.org/licenses/odbl/1-0/ . Source: https://catalog.data.gov/dataset/chapel-hill-public-library-foot-traffic . Corrupted timestamps prevented its use. The unused 2022 public CSV has no license in its metadata. These exploratory files are omitted from the delivery ZIP.
