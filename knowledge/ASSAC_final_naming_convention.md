# ASSAC 최종 프로젝트 네이밍 컨벤션

항공기 지연 패턴 분석 플랫폼(최종 프로젝트)의 이름 기준이다.
중간 프로젝트(petclinic) 문서와 **따로** 본다. 질문이 petclinic·WAS·CloudFront·WAF 이야기가 아니면 이 문서를 기준으로 답한다.

계정: `aca25`(ASSAC 팀 전용). 리전: `ap-northeast-2`. 1차 범위: 국내선.
이름과 태그에 `prod`, `dev`, `sesac`, `lcc`, 개인 이름을 넣지 않는다.

---

## 0. 읽는 순서

1. 만들 것이 **1장 인벤토리**에 있는지 찾는다. 있으면 그 이름만 쓴다.
2. 이미 만든 리소스(✅ 표시)는 이름을 바꾸지 않는다.
3. 없으면 **2장 규칙으로 조합**한다. 거절하지 않는다.
4. 헷갈리면 **3장 혼동 방지**를 본다.

---

## 1. 인벤토리

✅ = 이미 AWS에 만들어져 있음. 나머지는 만들 때 이 이름을 쓴다.

### 1.1 데이터 흐름

수집 Lambda → Kinesis → Flink → DynamoDB / Discord 알림 (실시간)
Kinesis → Firehose → S3 `assac-datalake/raw/` → Airflow(Glue → 품질 검사 → dbt → Athena, EMR 주 1회, SageMaker) (배치)
대시보드: ALB → Fargate → RDS / DynamoDB

### 1.2 수집 (Owner: `ingest-admin`)

| 리소스 | 확정 이름 | 비고 |
|---|---|---|
| S3 데이터 레이크 | `assac-datalake` ✅ | 원본·상태·격리 데이터를 prefix로 나눔 (2.4) |
| S3 과거 원본 자료 | `assac-origin` ✅ | 2020-01~2026-10 운항 원본. Owner `batch-admin` |
| Lambda 한국공항공사 수집 | `assac-collect-kac` ✅ | 등록번호 포함 국내 14개 공항 |
| Lambda 인천공항 수집 | `assac-collect-icn` | |
| Lambda ADS-B 수집 | `assac-collect-adsb` | 지금 개인 계정 이름(`sesac-lcc-adsb-*`)으로 도는 것을 옮길 때 이 이름 |
| Lambda 기상 수집 | `assac-collect-wx` | METAR/TAF |
| EventBridge Scheduler | `assac-schedule-<소스>` | 예: `assac-schedule-kac`, `assac-schedule-adsb` |
| Kinesis Data Stream | `assac-stream-events` | 수집 Lambda가 넣는 단일 스트림 |
| Data Firehose | `assac-firehose-raw` | Kinesis → `assac-datalake/raw/` |
| Parameter Store (API 키) | `/assac/data_go_kr_key` ✅ | 공공데이터포털 키. SecureString |

### 1.3 실시간 처리 · ML (Owner: `stream-admin`)

| 리소스 | 확정 이름 | 비고 |
|---|---|---|
| Managed Flink 앱 | `assac-flink-delay` | 기체별 상태 · 회전 시간 계산 |
| DynamoDB (기체 상태) | `assac-ddb-aircraft-state` | 대시보드 실시간 조회용 |
| EventBridge 규칙 | `assac-rule-delay-alert` | 다음 편 지연 가능성 이벤트 |
| SNS | `assac-sns-delay-alert` | |
| Lambda Discord 알림 | `assac-notify-discord` | SNS → Discord |
| Parameter Store (웹훅) | `/assac/discord_webhook` | |
| SageMaker 모델 | `assac-sm-delay-model` | 학습 작업은 `assac-sm-delay-train-<YYYYMMDD>` |
| SageMaker 엔드포인트 | `assac-sm-delay-endpoint` | 시연 끝나면 삭제 |

### 1.4 배치 · 마트 · 대시보드 (Owner: `batch-admin`)

| 리소스 | 확정 이름 | 비고 |
|---|---|---|
| Glue 작업 (정제) | `assac-glue-clean` | 중복 제거, 시간·공항 코드 통일 |
| Glue 작업 (회전) | `assac-glue-rotation` | 등록번호별 타임라인, 앞 편 도착·회전 시간 |
| Glue/Athena 데이터베이스 | `assac_raw`, `assac_curated`, `assac_mart` | **언더스코어 예외** (2.5) |
| Athena 워크그룹 | `assac-athena` | 결과는 `assac-datalake/athena-results/` |
| S3 Tables 버킷 | `assac-tables` | 네임스페이스 `curated`, `mart` |
| EMR Serverless 앱 | `assac-emr-trend` | 주 1회 3년 추세 분석 |
| RDS | `assac-rds-mart` | 대시보드용 마트 적재 |
| DB Subnet Group | `assac-sng-mart` | VPC 서브넷이 아님 |
| Parameter Store (DB 암호) | `/assac/rds_password` | |
| ECR 저장소 | `assac-ecr-dashboard` | |
| ECS 클러스터 | `assac-ecs` | |
| ECS 서비스 / 작업 정의 | `assac-svc-dashboard` / `assac-task-dashboard` | Fargate |

### 1.5 네트워크 · 오케스트레이션 (Owner: `platform-admin`)

| 리소스 | 확정 이름 | 비고 |
|---|---|---|
| VPC | `assac-vpc` | `10.0.0.0/16` |
| Internet Gateway | `assac-igw` | NAT 없음 (비용) |
| Subnet | `assac-subnet-public-a`, `assac-subnet-public-c`, `assac-subnet-private-a`, `assac-subnet-private-c` | 유형은 `public`/`private`, AZ는 `a`/`c` |
| Route Table | `assac-rt-public`, `assac-rt-private` | 유형당 1개 |
| VPC Endpoint | `assac-vpce-s3`, `assac-vpce-dynamodb` | 무료 게이트웨이형 |
| Security Group | `assac-sg-alb`, `assac-sg-dashboard`, `assac-sg-airflow`, `assac-sg-rds` | 용도당 1개 |
| ALB | `assac-alb` | 퍼블릭. 대시보드 앞단 |
| Target Group | `assac-tg-dashboard` | |
| EC2 (Airflow) | `assac-airflow` | Docker로 Airflow 실행. SSM 접속 |
| Airflow DAG | `assac_daily` | DAG ID는 언더스코어 (2.5) |

### 1.6 관측 · 비용 (Owner: `ingest-admin`)

| 리소스 | 확정 이름 | 비고 |
|---|---|---|
| Budget | `assac-budget` | |
| CloudWatch 대시보드 | `assac-dashboard` | |
| CloudWatch Alarm | `assac-alarm-<지표>` | 예: `assac-alarm-collect-errors`, `assac-alarm-kinesis-age` |
| SNS (운영 알림) | `assac-sns-ops-alert` | 비용·장애 → Discord |

### 1.7 IAM

| 종류 | 이름 | 비고 |
|---|---|---|
| Group | `assac-ingest-admins` ✅ | 나건호 (수집·모니터링·비용) |
| Group | `assac-stream-admins` ✅ | 이민규 (실시간·ML) |
| Group | `assac-batch-admins` ✅ | 김채연, 김사라 (배치·마트·대시보드) |
| User | `assac-ing-nkh`, `assac-str-lmg`, `assac-bat-kcy`, `assac-bat-ksr` ✅ | `assac-<역할 3글자>-<이니셜>` |
| Policy | `assac-self-mfa` ✅ | 본인 MFA·액세스 키 관리 |
| Policy | `assac-ingest-extras` ✅ | 그룹 정책 10개 한도를 넘는 추가 권한은 `assac-<그룹>-extras` |
| Role | `assac-collect-lambda-role` ✅ | 수집 Lambda 실행 역할 |
| Role | `assac-<용도>-<서비스>-role` | 예: `assac-notify-lambda-role`, `assac-glue-role`, `assac-flink-role`, `assac-github-actions-role` |

역할은 팀원이 요청하면 팀장이 만든다. 팀원에게는 역할 생성 권한이 없다.

---

## 2. 새 이름 조합 규칙

### 2.1 기본 형식

```
assac-<서비스 약어>-<용도>
```

- 소문자, 숫자, 하이픈만. 대문자·공백·한글 금지.
- 같은 종류가 2개 이상일 때만 끝에 `-01`, `-02`.
- AZ는 끝 한 글자 `a` 또는 `c`.

### 2.2 서비스 약어

| 약어 | 서비스 |
|---|---|
| `collect`, `notify` | Lambda (동작이 이름 앞에 옴: `assac-collect-<소스>`, `assac-notify-<대상>`) |
| `schedule` | EventBridge Scheduler |
| `stream` | Kinesis Data Stream |
| `firehose` | Data Firehose |
| `flink` | Managed Flink |
| `ddb` | DynamoDB |
| `rule` | EventBridge 규칙 |
| `sns` | SNS |
| `glue` | Glue 작업·크롤러 |
| `athena` | Athena 워크그룹 |
| `emr` | EMR Serverless |
| `sm` | SageMaker |
| `rds`, `sng` | RDS, DB Subnet Group |
| `ecr`, `ecs`, `svc`, `task` | 컨테이너 |
| `vpc`, `igw`, `subnet`, `rt`, `vpce`, `sg`, `alb`, `tg` | 네트워크 |
| `alarm`, `dashboard`, `budget` | 관측·비용 |

새 약어가 필요하면 이 표에 먼저 추가한다.

### 2.3 Lambda 조합 예

| 하는 일 | 이름 |
|---|---|
| 기상청 METAR 수집 | `assac-collect-wx` |
| 등록번호 백필 | `assac-collect-kac-backfill` |
| Slack 알림 | `assac-notify-slack` |
| 그 밖의 처리 | `assac-<동사>-<대상>` (예: `assac-check-quality`) |

### 2.4 S3 prefix (assac-datalake 안)

```
raw/<소스>/dt=YYYY-MM-DD/hour=HH/
state/<소스>/
quarantine/<소스>/dt=YYYY-MM-DD/
athena-results/
emr/
```

- 소스 이름: `kac`, `icn`, `adsb`, `wx`.
- prefix도 영어 소문자. 한글 폴더 이름 금지.

### 2.5 예외 (AWS·도구가 강제하는 것)

| 대상 | 형식 | 이유 |
|---|---|---|
| Parameter Store | `/assac/<이름>` | 슬래시 경로. 이름은 소문자+언더스코어 (`/assac/data_go_kr_key`) |
| Glue/Athena 데이터베이스·테이블 | `assac_raw`, `flights_daily` | Athena에서 하이픈이 오류를 냄 |
| Airflow DAG ID, dbt 모델 | `assac_daily`, `mart_delay_daily` | 파이썬 식별자 규칙 |
| Lambda 로그 그룹 | `/aws/lambda/<함수 이름>` | AWS 기본값 그대로 |
| S3 버킷 | 전 세계에서 유일해야 함 | 이미 있으면 팀에 공유 후 결정 |

---

## 3. 혼동 방지

| 말하는 것 | 맞는 이름 | 틀린 이름 |
|---|---|---|
| 데이터 레이크 / 원본 버킷 | `assac-datalake` | `sesac-lcc-*` |
| 과거 운항 자료 | `assac-origin` | `assac-datalake/raw/` |
| 스트림 | `assac-stream-events` (Kinesis) | Flink 앱 이름 |
| Flink | `assac-flink-delay` | `assac-stream-*` |
| 서브넷 그룹 | `assac-sng-mart` | `assac-subnet-*` |
| 대시보드 (화면) | `assac-svc-dashboard` (ECS) | `assac-dashboard` (CloudWatch) |
| CloudWatch 대시보드 | `assac-dashboard` | ECS 서비스 |
| 수집 Lambda 역할 | `assac-collect-lambda-role` | `assac-role-collect` (중간 프로젝트 형식) |

---

## 4. 태그

모든 리소스에 필수 2개. 이름을 제안할 때 항상 같이 적는다.

| 키 | 값 |
|---|---|
| `Team` | `ASSAC` |
| `Owner` | `ingest-admin` / `stream-admin` / `batch-admin` / `platform-admin` 중 하나 |

- 개인 이름, `Project`, `Environment` 태그 금지.
- 지금 일부 리소스에 붙은 `assac=collect` 태그는 위 2개로 바꾼다.

---

## 5. 운영 규칙

- 생성·삭제는 팀 채팅방에 한 줄 공유. 삭제는 미리 공유.
- 역할(IAM Role)은 팀장에게 요청.
- 액세스 키는 `~/.aws/credentials`에만. GitHub·노션·채팅방에 평문 금지. MFA 등록.
- 비싼 리소스(Flink, SageMaker 엔드포인트, RDS)는 만들기 전에 공유.

---

## 6. 한눈에 보기

```
수집        assac-datalake ✅ / assac-origin ✅
            assac-collect-kac ✅ / -icn / -adsb / -wx
            assac-schedule-<소스>
            assac-stream-events / assac-firehose-raw
            /assac/data_go_kr_key ✅

실시간·ML   assac-flink-delay / assac-ddb-aircraft-state
            assac-rule-delay-alert / assac-sns-delay-alert / assac-notify-discord
            assac-sm-delay-model / assac-sm-delay-endpoint

배치·마트   assac-glue-clean / assac-glue-rotation
            assac_raw / assac_curated / assac_mart
            assac-athena / assac-tables / assac-emr-trend
            assac-rds-mart / assac-sng-mart
            assac-ecr-dashboard / assac-ecs / assac-svc-dashboard

네트워크    assac-vpc / assac-igw
            assac-subnet-public-a,c / assac-subnet-private-a,c
            assac-rt-public / assac-rt-private / assac-vpce-s3 / assac-vpce-dynamodb
            assac-sg-alb / -dashboard / -airflow / -rds
            assac-alb / assac-tg-dashboard / assac-airflow

관측        assac-budget / assac-dashboard / assac-alarm-<지표> / assac-sns-ops-alert
```
