# ASSAC 최종 프로젝트 네이밍 컨벤션

승객의 여행 단계별 의사결정을 지원하는 **항공편 지연 정보 서비스**(최종 프로젝트)의 이름 기준이다.
중간 프로젝트(petclinic) 문서와 **완전히 따로** 본다. 질문에 petclinic·WAS·CloudFront·WAF·Bastion이 나오지 않으면 이 문서가 기준이다.

- 계정: `aca25` (ASSAC 팀 전용, `099407892777`)
- 리전: `ap-northeast-2` (AZ는 `a`, `c`만)
- 1차 범위: 국내선 (한국공항공사 14개 공항)
- 이름·태그 금지어: `prod`, `dev`, `test`(임시 자원 제외), `sesac`, `lcc`, 개인 이름, 팀 역할 코드(`a`~`e`, `c-`)

---

## 0. 이 문서를 쓰는 순서

1. **6장 인벤토리**에서 이미 있는 이름인지 찾는다. ✅면 그대로 쓴다.
2. 없으면 **2장 문법 → 3장 단어 사전 → 4장 서비스별 규칙** 순서로 이름을 조합한다.
3. **5장 AWS 제약**(길이·허용 문자)을 통과하는지 확인한다.
4. **7장 데이터 이름**(S3 경로, 테이블, 컬럼)은 리소스 이름과 별도 규칙이다.
5. 만든 뒤 **8장 태그**를 붙이고, 팀 채팅방에 한 줄 공유한다.

---

## 1. 원칙 (왜 이렇게 짓나)

| # | 원칙 | 설명 |
|---|---|---|
| P1 | 이름만 보고 종류와 용도를 안다 | `assac-rds-mart` → RDS, 마트용. 콘솔 목록에서 정렬했을 때 같은 종류끼리 모인다 |
| P2 | 사람·역할이 아니라 **하는 일**로 짓는다 | 담당자는 바뀐다. `assac-c-...`, `assac-nkh-...` 금지. 담당은 `Owner` 태그로 표시 |
| P3 | 영어 소문자 + 하이픈 | 한글·대문자·공백 금지. 예외는 2.4·5장에 명시한 것만 |
| P4 | 데이터 소스 이름은 하나로 고정 | `kac`, `icn`, `adsb`, `weather`, `airportal`만 쓴다 (3.2) |
| P5 | 이미 만든 것은 함부로 바꾸지 않는다 | 이름을 바꾸려면 대부분 다시 만들어야 한다. 6장에서 `변경 권장`인 것만 여유 있을 때 교체 |
| P6 | 줄이지 않는다 | `delay`를 `dly`로, `weather`를 `wx`로 줄이지 않는다. 3장 약어만 허용 |

---

## 2. 이름 문법

### 2.1 기본형: 종류가 앞

```
assac-<종류>-<대상>[-<세부>][-<AZ 또는 번호>]
```

| 칸 | 규칙 | 예 |
|---|---|---|
| `assac` | 항상 맨 앞 | |
| `<종류>` | 3.1 종류 약어 중 하나 | `rds`, `sg`, `glue`, `ddb` |
| `<대상>` | 무엇을 위한 것인지. 3.2 소스 이름 또는 3.3 용도 단어 | `mart`, `kac`, `delay` |
| `<세부>` | 같은 종류·대상이 여러 개일 때 구분 | `clean`, `rotation` |
| `<AZ/번호>` | AZ면 `a`/`c`, 같은 것이 2개 이상이면 `01`부터 | `assac-subnet-public-a` |

### 2.2 동작형: Lambda만 동사가 앞

Lambda는 "무엇을 하는 함수"라서 종류 대신 **동사**를 앞에 둔다.

```
assac-<동사>-<대상>[-<세부>]
```

| 동사 | 뜻 | 예 |
|---|---|---|
| `collect` | 외부 데이터 수집 | `assac-collect-kac`, `assac-collect-icn`, `assac-collect-weather` |
| `notify` | 알림 발송 | `assac-notify-discord` |
| `load` | 적재 | `assac-load-rds` |
| `check` | 점검·검증 | `assac-check-freshness` |
| `backfill` | 과거 데이터 재수집 | `assac-backfill-kac` |

새 동사가 필요하면 이 표에 먼저 추가한다.

### 2.3 접미형: IAM 역할·정책

| 종류 | 형식 | 언제 | 예 |
|---|---|---|---|
| 역할 (리소스 1개 전용) | `assac-<그 리소스 이름에서 assac- 뺀 부분>-role` | Lambda 하나, Flink 앱 하나처럼 1:1일 때 | Lambda `assac-collect-icn` → `assac-collect-icn-role` |
| 역할 (여러 리소스 공용) | `assac-<용도>-<서비스>-role` | 같은 종류 여러 개가 같이 쓸 때 | `assac-glue-role`, `assac-collect-lambda-role`, `assac-scheduler-invoke-role` |
| 사람용 추가 정책 | `assac-<그룹 이름>-extras` | 그룹 정책 10개 한도를 넘는 권한 | `assac-ingest-extras`, `assac-batch-extras` |
| 공통 정책 | `assac-<기능>` | 전원에게 붙는 것 | `assac-self-mfa` |
| 역할 인라인 정책 | `assac-<동사>-<대상>` | 역할 안에 넣는 정책 | `assac-collect-kac`, `assac-invoke-collect-kac` |

**역할 이름에 `-role`이 없으면 Lambda 함수와 이름이 같아져서 헷갈린다.** 반드시 `-role`로 끝낸다.

### 2.4 형식 예외 (AWS·도구가 강제)

| 대상 | 형식 | 이유 |
|---|---|---|
| Parameter Store | `/assac/<이름>` (이름은 소문자+언더스코어) | 경로형. `/assac/data_go_kr_key` |
| Glue/Athena 데이터베이스·테이블 | `assac_raw`, `flight_clean` | Athena에서 하이픈이 오류를 냄 |
| RDS 안의 DB·스키마·테이블·컬럼 | `assac`, `mart.flight_delay_daily` | PostgreSQL 식별자 규칙 |
| Airflow DAG·태스크 ID, dbt 모델 | `assac_daily`, `stg_kac_aircraft` | 파이썬 식별자 |
| Lambda·Glue 로그 그룹 | `/aws/lambda/<함수>`, `/aws-glue/jobs/...` | AWS 기본값 그대로 |
| S3 버킷 | 전 세계 유일 | 이미 있으면 뒤에 `-<계정 끝 4자리>`(`-2777`) |
| AWS가 자동으로 만드는 것 | `aws-glue-assets-...`, `AWSServiceRole...` | 건드리지 않음 |

---

## 3. 단어 사전

### 3.1 종류 약어 (이것만)

| 약어 | 서비스 | 약어 | 서비스 |
|---|---|---|---|
| `vpc` | VPC | `glue` | Glue 작업·크롤러 |
| `igw` | 인터넷 게이트웨이 | `athena` | Athena 워크그룹 |
| `subnet` | 서브넷 | `emr` | EMR Serverless |
| `rt` | 라우팅 테이블 | `stream` | Kinesis Data Stream |
| `vpce` | VPC 엔드포인트 | `firehose` | Data Firehose |
| `sg` | 보안 그룹 | `flink` | Managed Flink |
| `alb` | ALB | `ddb` | DynamoDB |
| `tg` | 대상 그룹 | `sns` | SNS |
| `ec2` | EC2 인스턴스 (Airflow는 `airflow`) | `rule` | EventBridge 규칙 |
| `rds` | RDS 인스턴스 | `schedule` | EventBridge Scheduler |
| `sng` | DB 서브넷 그룹 | `ecr` | ECR 저장소 |
| `alarm` | CloudWatch 알람 | `ecs` | ECS 클러스터 |
| `dashboard` | CloudWatch 대시보드 | `svc` / `task` | ECS 서비스 / 작업 정의 |
| `budget` | Budgets | `sm` | SageMaker (쓰게 되면) |

### 3.2 데이터 소스 이름 (고정)

| 이름 | 데이터 | 비고 |
|---|---|---|
| `kac` | 한국공항공사 운항·기종·등록번호 | 국내 14개 공항 |
| `icn` | 인천국제공항공사 운항 | |
| `adsb` | ADS-B 항공기 위치 (adsb.fi) | |
| `weather` | 공항 기상 (METAR·TAF·과거 관측) | `wx` 쓰지 않음 |
| `airportal` | 항공정보포털 과거 운항 실적 (2020-01~) | |

### 3.3 용도 단어

| 단어 | 뜻 | 예 |
|---|---|---|
| `raw` | 원본 그대로 | `assac-stream-raw` |
| `clean` | 정제 | `assac-glue-airportal-clean` |
| `rotation` | 같은 기체 연결·준비 시간 계산 | `assac-glue-kac-rotation` |
| `mart` | 화면·분석용 집계 | `assac-rds-mart` |
| `delay` | 지연 계산·알림 | `assac-flink-delay` |
| `aircraft` | 기체 단위 | `assac-ddb-aircraft-state` |
| `flight` | 편 단위 | `assac-ddb-flight-state` |
| `state` | 최신 상태 저장 | |
| `alert` | 알림 | `assac-sns-delay-alert` |
| `dashboard` | 대시보드 화면 | `assac-svc-dashboard` |
| `ops` | 운영·비용 | `assac-sns-ops-alert` |

---

## 4. 서비스별 규칙과 예

### 4.1 네트워크 (Owner `platform-admin`)

| 리소스 | 형식 | 확정 이름 |
|---|---|---|
| VPC | `assac-vpc` | `assac-vpc` ✅ |
| 인터넷 게이트웨이 | `assac-igw` | `assac-igw` ✅ |
| 서브넷 | `assac-subnet-<public/private>-<a/c>` | `assac-subnet-public-a` ✅ 외 3개 |
| 라우팅 테이블 | `assac-rt-<public/private>` | `assac-rt-public` ✅, `assac-rt-private` ✅ |
| VPC 엔드포인트 | `assac-vpce-<서비스>` | `assac-vpce-s3` ✅, `assac-vpce-dynamodb` ✅ |
| 보안 그룹 | `assac-sg-<붙는 대상>` | `assac-sg-alb` ✅, `-dashboard` ✅, `-airflow` ✅, `-rds` ✅ |
| ALB / 대상 그룹 | `assac-alb`, `assac-tg-<대상>` | `assac-alb`, `assac-tg-dashboard` |

NAT 게이트웨이는 비용 때문에 두지 않는다. AZ로 쪼개는 것은 서브넷뿐이다.

### 4.2 수집 (Owner `ingest-admin`)

| 리소스 | 형식 | 예 |
|---|---|---|
| 수집 Lambda | `assac-collect-<소스>[-<세부>]` | `assac-collect-kac` ✅, `assac-collect-icn`, `assac-collect-weather`, `assac-collect-adsb` |
| 재수집 Lambda | `assac-backfill-<소스>` | `assac-backfill-kac` |
| 스케줄 | `assac-schedule-<소스>-<주기>` | `assac-schedule-icn-15min`, `assac-schedule-weather-30min` |
| 수집 Lambda 역할 | 공용 `assac-collect-lambda-role` 또는 전용 `assac-collect-<소스>-role` | |
| 스케줄 실행 역할 | `assac-scheduler-invoke-role` (공용) | ✅ |
| Kinesis | `assac-stream-<용도>` | 기존 `assac-aviation-raw-stream` ✅ (6장 참고) |
| Firehose | `assac-firehose-<용도>` | `assac-firehose-raw` |
| API 키 | `/assac/<제공처>_key` | `/assac/data_go_kr_key` ✅ |

주기 표기는 `1min`, `15min`, `30min`, `1h`, `daily`.

### 4.3 배치·마트 (Owner `batch-admin`)

| 리소스 | 형식 | 예 |
|---|---|---|
| Glue 작업 | `assac-glue-<소스>-<단계>` | `assac-glue-airportal-clean`, `assac-glue-kac-clean`, `assac-glue-kac-rotation` |
| Glue 크롤러 | `assac-crawler-<층>-<소스>` | `assac-crawler-raw-kac` |
| Glue/Athena DB | `assac_<층>` | `assac_raw`, `assac_clean`, `assac_mart` |
| Athena 워크그룹 | `assac-athena` | |
| EMR Serverless | `assac-emr-<용도>` | `assac-emr-trend` |
| RDS 인스턴스 | `assac-rds-<용도>` | `assac-rds-mart` ✅ |
| DB 서브넷 그룹 | `assac-sng-<용도>` | `assac-sng-mart` ✅ |
| RDS DB / 관리자 | `assac` / `assac_admin` | ✅ |
| RDS 암호 | `/assac/rds_password` | ✅ |
| ECR / ECS | `assac-ecr-<앱>`, `assac-ecs`, `assac-svc-<앱>`, `assac-task-<앱>` | `assac-ecr-dashboard` |

Glue 작업 단계 단어는 `clean`(정제), `rotation`(기체 연결), `quality`(품질 검사), `mart`(마트 생성)만 쓴다.

### 4.4 실시간 (Owner `stream-admin`)

| 리소스 | 형식 | 예 |
|---|---|---|
| Flink 앱 | `assac-flink-<용도>` | `assac-flink-delay` |
| DynamoDB | `assac-ddb-<단위>-<용도>` | `assac-ddb-aircraft-state`, `assac-ddb-flight-state` |
| EventBridge 규칙 | `assac-rule-<용도>` | `assac-rule-delay-alert` |
| SNS | `assac-sns-<용도>` | `assac-sns-delay-alert`, `assac-sns-ops-alert` |
| 알림 Lambda | `assac-notify-<채널>` | `assac-notify-discord` |
| 웹훅 | `/assac/discord_webhook` | |

### 4.5 오케스트레이션·관측 (Owner `platform-admin` / `ingest-admin`)

| 리소스 | 형식 | 예 |
|---|---|---|
| Airflow EC2 | `assac-airflow` | |
| Airflow DAG | `assac_<주기>` 또는 `assac_<주기>_<용도>` | `assac_daily`, `assac_weekly_trend` |
| Airflow 태스크 | `<동사>_<대상>` | `run_glue_kac_clean`, `load_rds_mart` |
| CloudWatch 알람 | `assac-alarm-<대상>-<지표>` | `assac-alarm-collect-kac-errors`, `assac-alarm-rds-cpu` |
| CloudWatch 대시보드 | `assac-dashboard` | |
| 사용자 정의 로그 그룹 | `/assac/<서비스>` | `/assac/airflow` |
| Budget | `assac-budget` | |

---

## 5. AWS 제약 (만들기 전에 확인)

| 서비스 | 길이 | 허용 문자 | 주의 |
|---|---|---|---|
| S3 버킷 | 3~63 | 소문자, 숫자, `-`, `.` | 전 세계 유일. 대문자·`_` 불가 |
| Lambda | 1~64 | 영문, 숫자, `-`, `_` | 우리는 소문자+`-`만 |
| IAM 역할·정책 | 역할 64, 정책 128 | 영문, 숫자, `+=,.@-_` | 생성 후 이름 변경 불가 |
| EventBridge Scheduler | 1~64 | 영문, 숫자, `-`, `_`, `.` | |
| Kinesis 스트림 | 1~128 | 영문, 숫자, `-`, `_`, `.` | 이름 바꾸려면 다시 만들어야 함 |
| DynamoDB 테이블 | 3~255 | 영문, 숫자, `-`, `_`, `.` | |
| Glue 작업 | 1~255 | 대부분 허용 | 우리는 소문자+`-` |
| Glue/Athena DB·테이블 | 1~255 | 소문자, 숫자, `_` | 하이픈 쓰면 Athena에서 따옴표 필요 → 금지 |
| RDS 인스턴스 ID | 1~63 | 소문자, 숫자, `-` | 문자로 시작, `--`·끝 하이픈 불가 |
| RDS DB 이름 | 1~63 | 영문, 숫자, `_` | 문자로 시작 |
| 보안 그룹 | 1~255 | 대부분 허용 | `sg-`로 시작 불가 → 그래서 `assac-sg-...` |
| Parameter Store | 경로 1~2048 | 영문, 숫자, `_.-/` | 15단계 경로까지 |

**공통 금지:** 하이픈으로 시작·끝, `--` 연속, 공백, 한글.

---

## 6. 인벤토리와 기존 리소스 대조

상태: ✅ 규칙에 맞음 · 🟡 규칙과 다르지만 유지 (다시 만들 비용 > 이득) · 🔁 여유 있을 때 교체 권장

| 리소스 | 지금 이름 | 상태 | 규칙상 이름 | 비고 |
|---|---|---|---|---|
| S3 데이터 레이크 | `assac-datalake` | ✅ | | |
| S3 과거 원본 | `assac-origin` | ✅ | | 항공정보포털 원본 보관 |
| Lambda | `assac-collect-kac` | ✅ | | 1분 주기 |
| 스케줄 | `assac-kac-1min` | 🔁 | `assac-schedule-kac-1min` | 다시 만들기 쉬움 |
| 스케줄 실행 역할 | `assac-scheduler-invoke-role` | ✅ | | |
| 수집 Lambda 공용 역할 | `assac-collect-lambda-role` | ✅ | | |
| 역할 | `assac-collect-icn` | 🔁 | `assac-collect-icn-role` | Lambda 이름과 같아 헷갈림 |
| 역할 | `assac-collect-weather` | 🔁 | `assac-collect-weather-role` | 같은 이유 |
| Glue 역할 | `assac-glue-role` | ✅ | | |
| Glue 작업 | `assac-c-airportal-clean` | 🔁 | `assac-glue-airportal-clean` | 역할 코드 `c` 금지 |
| Kinesis | `assac-aviation-raw-stream` | 🟡 | `assac-stream-raw` | 생산자 연결 전이면 교체 권장 |
| 정책 | `assac-self-mfa`, `assac-ingest-extras`, `assac-batch-extras` | ✅ | | |
| 파라미터 | `/assac/data_go_kr_key`, `/assac/rds_password` | ✅ | | |
| 네트워크 | `assac-vpc`, `assac-igw`, 서브넷 4개, 라우팅 테이블 2개, `assac-vpce-s3`, `assac-vpce-dynamodb`, 보안 그룹 4개 | ✅ | | |
| RDS | `assac-rds-mart`, `assac-sng-mart` | ✅ | | PostgreSQL, DB `assac` |
| ADS-B 수집 | `sesac-lcc-adsb-collector`, `sesac-lcc-adsb-every-minute` | 🔁 | `assac-collect-adsb`, `assac-schedule-adsb-1min` | 개인 이름으로 시작한 자원. 팀 버킷으로 옮길 때 교체 |

### IAM 그룹·사용자

| 그룹 | 사용자 | 하는 일 |
|---|---|---|
| `assac-ingest-admins` ✅ | `assac-ing-nkh` | 수집·모니터링·비용 |
| `assac-stream-admins` ✅ | `assac-str-lmg` | 실시간 처리 |
| `assac-batch-admins` ✅ | `assac-bat-kcy`, `assac-bat-ksr` | 배치·마트·대시보드 |

사용자 이름은 `assac-<역할 3글자>-<이니셜>`. 사람 이름이 들어가는 유일한 곳이다.

---

## 7. 데이터 이름 (S3 경로·테이블·컬럼)

### 7.1 S3 경로 (`assac-datalake` 안)

```
<층>/<소스>/<데이터셋>/dt=YYYYMMDD/[hour=HH/]<파일>
```

| 층 | 뜻 | 메달리온 | 예 |
|---|---|---|---|
| `raw/` | 받은 그대로 | 브론즈 | `raw/kac/aircraft/dt=20261124/181816.jsonl` |
| `state/` | 수집기의 직전 상태(비교용) | - | `state/kac/aircraft/searchday=20261124.json` |
| `clean/` | 정제·통합 | 실버 | `clean/airportal/flight_clean/` |
| `mart/` | 화면·분석용 집계 | 골드 | `mart/route_delay_daily/` |
| `quarantine/` | 품질 검사 탈락 | - | `quarantine/kac/aircraft/dt=20261124/` |
| `athena-results/` | Athena 결과 | - | |
| `glue/scripts/` | Glue 코드·참조표 | - | `glue/scripts/cause_map.csv` |

- **데이터셋 이름은 영어 snake_case.** 지금 `clean/airportal/국내선_출도착연결/`, `clean/airportal/운항_정제_여객/`은 한글이라 🔁 `clean/airportal/flight_connection/`, `clean/airportal/flight_clean/`으로 교체 권장.
- **날짜 파티션은 `dt=YYYYMMDD`** (하이픈 없음). 시간까지 나누면 `hour=HH`.
- 파일 이름에 소스·날짜를 반복하지 않는다. 경로가 이미 말해 준다.

### 7.2 테이블

| 위치 | 형식 | 예 |
|---|---|---|
| Glue/Athena | DB `assac_<층>` + 테이블 `<소스>_<데이터셋>` | `assac_raw.kac_aircraft`, `assac_clean.airportal_flight_clean` |
| dbt 모델 | `stg_<소스>_<데이터셋>` → `int_<내용>` → `mart_<내용>` | `stg_kac_aircraft`, `int_aircraft_rotation`, `mart_route_delay_daily` |
| RDS | 스키마 `mart` + 테이블 `<내용>` | `mart.route_delay_daily`, `mart.flight_delay_history` |

마트 테이블 이름은 **"무엇을 · 어떤 단위로"**: `<대상>_<측정>_<단위>` (`route_delay_daily`, `flight_ontime_rate_monthly`).

### 7.3 컬럼

| 종류 | 규칙 | 예 |
|---|---|---|
| 편명 | `flight_no` | `RS6408` |
| 등록번호 | `reg_no` | `HL8072` |
| 기종 | `aircraft_type` | `A321` |
| 항공사 | `airline_code` (IATA 2자리), `airline_name` | `RS` |
| 공항 | `dep_airport`, `arr_airport` (IATA 3자리) | `GMP`, `CJU` |
| 시각 | `<무엇>_<계획/실제>_at`, 모두 한국 시간 | `dep_sched_at`, `dep_actual_at`, `arr_sched_at`, `arr_actual_at` |
| 날짜 | `<무엇>_date` | `flight_date` |
| 분 단위 | `_min` | `dep_delay_min`, `turnaround_min` |
| 건수 | `_cnt` | `delayed_cnt` |
| 비율 | `_rate` (0~1) | `ontime_rate` |
| 백분위 | `_p50`, `_p90` | `arr_delay_p90` |
| 참·거짓 | `is_` / `has_` | `is_codeshare`, `is_cancelled`, `has_prev_flight` |
| 코드값 | `_code` | `delay_cause_code` |
| 수집 메타 | `_collected_at`, `_source`, `_change` (밑줄로 시작) | 원본에서 온 메타 정보 |

용어는 쉬운 말로 통일한다: 회전 시간 → `turnaround`(준비 시간), 앞 편 → `prev_flight`, 다음 편 → `next_flight`.

---

## 8. 태그

모든 리소스에 필수 2개. 이름을 제안할 때 항상 같이 적는다.

| 키 | 값 |
|---|---|
| `Team` | `ASSAC` |
| `Owner` | `ingest-admin` · `stream-admin` · `batch-admin` · `platform-admin` 중 하나 |

| 선택 키 | 값 | 언제 |
|---|---|---|
| `Name` | 리소스 이름 | EC2·VPC·서브넷·보안 그룹처럼 이름 칸이 태그인 것 |
| `Source` | 3.2 소스 이름 | 수집 Lambda·스케줄·Glue 작업 |
| `Temporary` | `true` | 시험용. 끝나면 삭제 |

- `Project`, `Environment`, 개인 이름 태그 금지.
- 지금 일부 리소스의 `assac=collect` 태그는 위 형식으로 바꾼다.

### Owner 고르는 법

| 리소스가 하는 일 | Owner |
|---|---|
| 외부 데이터 수집, 모니터링, 비용 | `ingest-admin` |
| 실시간 처리, 알림 | `stream-admin` |
| 정제, 마트, RDS, 대시보드 화면 | `batch-admin` |
| 네트워크, Airflow, 배포, IAM 공용 | `platform-admin` |

---

## 9. 자주 틀리는 것

| 틀린 이름 | 왜 틀렸나 | 맞는 이름 |
|---|---|---|
| `assac-c-glue-role` | 역할 코드 `c` | `assac-glue-role` |
| `assac-collect-icn` (역할) | Lambda와 같은 이름 | `assac-collect-icn-role` |
| `assac-wx-collector` | `wx` 줄임말, 동사가 뒤 | `assac-collect-weather` |
| `assac-raw-bucket` | 버킷은 레이크 하나 | `assac-datalake/raw/` |
| `assac_glue_clean` | 리소스 이름에 언더스코어 | `assac-glue-airportal-clean` |
| `assac-raw.kac` (Athena) | DB에 하이픈 | `assac_raw.kac_aircraft` |
| `clean/airportal/운항_정제_여객/` | 한글 경로 | `clean/airportal/flight_clean/` |
| `assac-rds-petclinic` | 중간 프로젝트 이름 | `assac-rds-mart` |
| `sesac-lcc-...` | 이전 개인 접두사 | `assac-...` |

---

## 10. 한눈에 보기

```
네트워크    assac-vpc / assac-igw
            assac-subnet-public-a,c / assac-subnet-private-a,c
            assac-rt-public / assac-rt-private
            assac-vpce-s3 / assac-vpce-dynamodb
            assac-sg-alb / -dashboard / -airflow / -rds
            assac-alb / assac-tg-dashboard / assac-airflow

수집        assac-datalake / assac-origin
            assac-collect-kac ✅ / -icn / -weather / -adsb
            assac-schedule-<소스>-<주기>
            assac-stream-raw (현재 assac-aviation-raw-stream) / assac-firehose-raw
            /assac/data_go_kr_key

배치·마트   assac-glue-<소스>-<clean|rotation|quality|mart>
            assac_raw / assac_clean / assac_mart
            assac-athena / assac-emr-trend
            assac-rds-mart / assac-sng-mart / DB assac / mart.<테이블>
            assac-ecr-dashboard / assac-ecs / assac-svc-dashboard

실시간      assac-flink-delay / assac-ddb-aircraft-state / assac-ddb-flight-state
            assac-rule-delay-alert / assac-sns-delay-alert / assac-notify-discord

IAM         assac-<리소스>-role / assac-<용도>-<서비스>-role
            assac-<그룹>-extras / assac-self-mfa

관측        assac-alarm-<대상>-<지표> / assac-dashboard / assac-budget / assac-sns-ops-alert

데이터      <raw|clean|mart>/<소스>/<데이터셋>/dt=YYYYMMDD/
            컬럼: flight_no, reg_no, dep_sched_at, dep_delay_min, is_codeshare ...
```
