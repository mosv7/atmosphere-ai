# Atmosphere AI — five-minute English speaker script

Aligned with the 26 October 2026 proposal, version 1.1. Eight slides; target duration 5:00, including brief pauses. Results refer to the documented 15 October experiment, not a new evaluation. The PowerPoint notes include both language editions.

## 1. Atmosphere AI

**0:00 – 0:25 | 25 seconds**

We check the weather before going outside. But what about the air we breathe? Atmosphere AI brings air quality data, historical trends and hourly PM2.5 forecasts into one experience. The proposal builds on a working prototype. Today I will explain who it serves, how it works, what the experiment shows and what still needs development.

*Cue: introduce the project over the Earth image.*

## 2. Readings need context

**0:25 – 1:00 | 35 seconds**

A concentration alone leaves questions unanswered. When was it recorded? Is pollution rising? What might happen next? Residents and commuters need context for outdoor plans. Students and researchers need traceable data and models they can evaluate. Environmental analysts and educators need city comparisons. These are intended benefits that still need user feedback. We have not demonstrated reduced pollution exposure, and the platform does not provide medical advice or official health alerts.

*Cue: point to the timestamp and historical trend in the mobile screenshot.*

## 3. The user experience

**1:00 – 1:45 | 45 seconds**

This is an actual screenshot from the prototype. Users choose a city through search or the map, then inspect available pollutant readings, their source and timestamp. They can explore history and current weather, compare two to five cities, inspect dataset coverage or review model performance. Forecasts are available for seven training cities; worldwide city search does not mean worldwide forecasting. The interface supports mobile layouts and light and dark themes, and explains missing data. Acceptance means checking these complete journeys, including errors and retries, and gathering feedback about city selection, timestamps and the distinction between history and forecasts.

*Cue: point to city selection, the map and source information.*

## 4. The forecast target

**1:45 – 2:30 | 45 seconds**

The model predicts PM2.5 concentration: fine particles in the air, measured in micrograms per cubic metre. A successful request returns seventy-two consecutive hourly predictions with timestamps and a model version. The solid line shows historical source estimates; the dashed line shows predictions. This screenshot displays only the first twenty-four hours. Forecasting requires seventy-three consecutive hours of nonmissing PM2.5 history. Insufficient data and unsupported locations are rejected with an explanation. These are concentration forecasts, not an official air quality index. PM10 forecasting and calibrated prediction intervals are outside the current implementation.

*Cue: distinguish the solid and dashed lines; the screenshot is a historical example.*

## 5. Data and model pipeline

**2:30 – 3:15 | 45 seconds**

The documented experiment used seventy thousand and thirty-two hourly air quality records across eight cities, covering roughly one year. Inputs are CAMS environmental model estimates served through Open-Meteo, not direct station measurements. Features include previous pollution levels, rolling trends, time, location and forecast horizon. Weather is displayed but excluded from the current estimator. Four classical algorithms were compared with two simple baselines. One pooled model trains on ten selected horizons; evaluation and inference cover all seventy-two. Training runs separately from user requests, saving a versioned artifact that the API uses to produce and store forecasts.

*Cue: follow the pipeline from collection to display.*

## 6. Documented feasibility results

**3:15 – 4:00 | 45 seconds**

These are the documented results from October fifteenth, not a fresh measurement. LightGBM was selected using validation error. Its known-city test mean absolute error was eight point five eight micrograms per cubic metre, about sixteen point four six percent below the last-reading baseline. XGBoost had slightly lower test error, but we did not change selection after seeing the test. Chronological splits use a seventy-two-hour purge to avoid overlapping targets. Nairobi was excluded from training and selection. These retrospective archive results do not establish historical issue-time performance because original availability and revisions were not verified.

*Cue: lower MAE is better; the percentage is error reduction, not accuracy.*

## 7. Current limitations

**4:00 – 4:35 | 35 seconds**

The prototype serves forecasts for seven training cities. Nairobi remains a separate evaluation city; its lower raw error does not establish worldwide accuracy. The source is an environmental model, and station validation remains future work. Prediction intervals have not been calibrated. There is no official AQI, PM10 forecast or demonstrated health benefit. Docker and local operation exist, but public application hosting, monitoring and backups remain proposed work. We need independent evidence before extending coverage or presenting reliable uncertainty.

*Cue: separate implemented functions from proposed improvements.*

## 8. Proposed four-week plan

**4:35 – 5:00 | 25 seconds**

The proposal estimates four weeks: data and QA freeze the dataset; ML evaluates coverage; ML and frontend trial calibration and weather exploration; operations and QA pilot hosting and backups. A coordinator tracks acceptance, including user feedback. Roles may overlap. Timing depends on approval and resources; station integration may take longer. The code and methodology are on GitHub. Thank you.

*Cue: leave the four-week plan and repository link visible.*
