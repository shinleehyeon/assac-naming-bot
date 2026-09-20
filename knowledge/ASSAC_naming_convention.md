# ASSAC 네이밍 컨벤션

이 문서가 유일한 기준이다.
이미 아키텍처에 있는 것은 **1장 확정 이름**을 그대로 쓴다.
아직 인벤토리에 없는 리소스(예: 부하테스트 Lambda)는 거절하지 말고 **2장 규칙으로 조합**한다.

계정: ASSAC 팀 전용 1개. 앱: petclinic 3-tier 1개. 리전: `ap-northeast-2`. 도메인: `petclinic.hyeon.im`.
이름과 태그에 `prod`, `dev`, `petclinic-3tier`를 넣지 않는다.

---

## 0. 이 문서를 읽는 순서

1. 만들고 싶은 것이 **1장 인벤토리**에 있는지 찾는다.
2. 있으면 **그 칸의 이름만** 쓴다. 변형하지 않는다.
3. 없으면 **2장으로 이름을 조합**한다. 인벤토리에 없다고 거절하지 않는다.
4. 같은 말을 여러 리소스로 들을 수 있으면 **3장 혼동 방지**를 본다.

---

## 1. 아키텍처 인벤토리 (만들 것 전부)

다이어그램에 있는 것과, 그걸 동작시키려면 반드시 같이 생기는 리소스만 적었다.
ECS, DynamoDB 앱 테이블, SQS, 퍼블릭 ALB는 **이 구성에 없다.**

### 1.1 트래픽 경로

사용자 → Route53(`petclinic.hyeon.im`) → CloudFront(+WAF) → (정적) S3 또는 (앱) VPC Origin → 내부 ALB → WAS ASG.
WAF 로그 → CloudWatch Logs → Lambda → Slack.

### 1.2 네트워크

| # | AWS 리소스 | 개수 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|---|
| N1 | VPC | 1 | `assac-vpc` | network-admin | |
| N2 | Internet Gateway | 1 | `assac-igw` | network-admin | |
| N3 | Subnet | 6 | 아래 1.3 | network-admin | 유형×AZ. 앱 이름 금지 |
| N4 | Route Table | 3 | `assac-rt-public`, `assac-rt-was`, `assac-rt-db` | network-admin | 서브넷 유형당 1개. AZ로 쪼개지 않음 |
| N5 | NACL | 3 | `assac-nacl-public`, `assac-nacl-was`, `assac-nacl-db` | network-admin | 라우트 테이블과 같은 유형 단어 |
| N6 | NAT Gateway | 1 | `assac-nat-a` | network-admin | **AZ-a만.** AZ-c에 NAT를 두지 않음 |
| N7 | EIP | 1 | `assac-eip-nat-a` | network-admin | NAT 전용 |
| N8 | Security Group | 6 | 아래 1.4 | 표 참고 | 용도당 1개. AZ 붙이지 않음 |

### 1.3 서브넷 확정 목록

형식은 전부 `assac-subnet-<유형>-<az>`다. 유형은 `public` / `was` / `db`만. AZ는 `a` / `c`만.

| 이름 | AZ | 유형 | 이 안에 두는 것 |
|---|---|---|---|
| `assac-subnet-public-a` | a | public | NAT, Bastion |
| `assac-subnet-public-c` | c | public | 예비 퍼블릭. NAT/Bastion 없음 |
| `assac-subnet-was-a` | a | private | ASG, WAS-01, SSM, SNS |
| `assac-subnet-was-c` | c | private | WAS-02, API Gateway, Lambda |
| `assac-subnet-db-a` | a | private | RDS 한쪽, Secrets Manager |
| `assac-subnet-db-c` | c | private | RDS 다른쪽 |

금지: `assac-subnet-db-petclinic`, `assac-dbsubnet-*`를 서브넷으로 부르는 것, `assac-subnet-was-az-a`.

### 1.4 보안 그룹 확정 목록

형식은 전부 `assac-sg-<용도>`다. 용도는 아래 6개만.

| 이름 | Owner | 붙이는 대상 |
|---|---|---|
| `assac-sg-alb` | network-admin | 내부 ALB |
| `assac-sg-was` | app-deploy-admin | WAS 인스턴스 / ASG |
| `assac-sg-db` | data-security-admin | RDS |
| `assac-sg-bastion` | ops-admin | Bastion |
| `assac-sg-lambda` | app-deploy-admin | VPC Lambda |
| `assac-sg-apigw` | app-deploy-admin | API Gateway VPC 연결 |

### 1.5 컴퓨트 · 로드밸런싱

| # | AWS 리소스 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|
| C1 | ALB (internal) | `assac-alb-internal` | network-admin | 퍼블릭 ALB 없음. 인터넷은 CloudFront |
| C2 | Target Group | `assac-tg-was` | app-deploy-admin | ALB → WAS만 |
| C3 | Launch Template | `assac-lt-was` | app-deploy-admin | |
| C4 | Auto Scaling Group | `assac-asg-was` | app-deploy-admin | WAS 서브넷 a,c |
| C5 | EC2 WAS | `assac-was-01`, `assac-was-02` | app-deploy-admin | 01=AZ-a, 02=AZ-c. 이름에 petclinic 금지 |
| C6 | EC2 Bastion | `assac-bastion` | ops-admin | public-a. 1대라 번호 없음. SSM 사용 |
| C7 | IAM Instance Profile | `assac-profile-was`, `assac-profile-bastion` | ops-admin | 역할과 짝 |
| C8 | SNS (ASG 알림) | `assac-sns-asg-alert` | ops-admin | |

ASG가 인스턴스를 새로 띄워도 Name 태그는 `assac-was-01` / `02` 규칙을 유지한다. 세 번째 WAS가 생기면 `assac-was-03`이고 AZ는 a/c를 번갈아 쓴다.

### 1.6 데이터

| # | AWS 리소스 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|
| D1 | RDS (Multi-AZ) | `assac-rds-petclinic` | data-security-admin | 인스턴스 1세트. 서브넷이 아님 |
| D2 | DB Subnet Group | `assac-sng-petclinic` | data-security-admin | RDS가 쓰는 그룹. VPC 서브넷이 아님 |
| D3 | Secrets Manager | `assac/rds/petclinic` | data-security-admin | 슬래시. 하이픈 이름 금지 |

RDS 엔드포인트·스냅샷 설명에도 `assac-rds-petclinic`을 쓴다.

### 1.7 엣지 · 스토리지

| # | AWS 리소스 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|
| E1 | Route53 레코드 | `petclinic.hyeon.im` | edge-security-admin | 도메인 자체가 이름 |
| E2 | ACM 인증서 | Tag `Name=assac-cert` | edge-security-admin | CloudFront용은 보통 `us-east-1`. 인증서 CN은 도메인 |
| E3 | CloudFront | Comment `assac-cdn` | edge-security-admin | 배포 ID는 AWS가 부여. 우리가 정하는 이름은 Comment/Tag |
| E4 | CloudFront VPC Origin | Comment `assac-vpc-origin` | edge-security-admin | ALB로 연결 |
| E5 | WAF Web ACL | `assac-waf-cloudfront` | edge-security-admin | CloudFront 전용. ALB에 WAF 없음 |
| E6 | S3 정적 | `assac-static-<acct4>` | edge-security-admin | CloudFront origin |
| E7 | S3 로그 | `assac-logs-<acct4>` | ops-admin | CF/ALB/WAF 로그 버킷 |
| E8 | S3 Terraform state | `assac-terraform-state-<acct4>` | ops-admin | IaC. 앱 버킷과 분리 |

`<acct4>`는 계정 ID 마지막 4자리. **팀에서 한 번 정하면 모든 S3에 같은 값을 쓴다.** 예: `3921`.

### 1.8 서버리스 · AI

| # | AWS 리소스 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|
| S1 | Lambda (WAF→Slack) | `assac-lambda-waf-alert` | edge-security-admin | 리전 Lambda. VPC 불필요하면 SG 없음 |
| S2 | Lambda (Bedrock/챗봇) | `assac-lambda-chatbot` | app-deploy-admin | was-c, `assac-sg-lambda` |
| S3 | API Gateway | `assac-apigw-chatbot` | app-deploy-admin | Lambda 챗봇 앞단 |
| S4 | Bedrock | 이름 없음 | app-deploy-admin | 관리형 모델. IAM으로만 통제 |

기능 단어는 고정이다. `assac-lambda-waf`, `assac-lambda-alert`처럼 줄이지 않는다.

### 1.9 로그 · 관측 · 보안 · 비용

| # | AWS 리소스 | 확정 이름 | Owner | 비고 |
|---|---|---|---|---|
| O1 | CW Log Group (WAF) | `aws-waf-logs-assac` | edge-security-admin | AWS WAF CloudWatch 연동. `aws-waf-logs-` 접두사 필수. `/assac/waf-logs` 금지 |
| O2 | CW Log Group (WAS) | `/assac/was` | app-deploy-admin | |
| O3 | CW Log Group (ALB) | `/assac/alb` | network-admin | |
| O4 | CW Log Group (Lambda WAF) | `/assac/lambda-waf-alert` | edge-security-admin | |
| O5 | CW Log Group (Lambda 챗봇) | `/assac/lambda-chatbot` | app-deploy-admin | |
| O6 | CW Dashboard | `assac-dashboard` | ops-admin | 1개 |
| O7 | CW Alarm | `assac-alarm-<지표>` | ops-admin | 허용 지표는 1.10 |
| O8 | AMP Workspace | `assac-amp` | ops-admin | |
| O9 | AMG Workspace | `assac-amg` | ops-admin | |
| O10 | GuardDuty | Tag `Name=assac-guardduty` | data-security-admin | 리전당 detector 1개 |
| O11 | Budget | `assac-budget` | ops-admin | |

### 1.10 CloudWatch Alarm 허용 목록

새 알람이 필요하면 이 표에 추가한 뒤 만든다.

| 이름 | 대상 |
|---|---|
| `assac-alarm-alb-5xx` | ALB 5xx |
| `assac-alarm-alb-unhealthy` | TG unhealthy host |
| `assac-alarm-asg-cpu` | WAS ASG CPU |
| `assac-alarm-rds-cpu` | RDS CPU |
| `assac-alarm-rds-storage` | RDS 스토리지 |
| `assac-alarm-nat-port` | NAT 포트 고갈 |

### 1.11 IAM

사람 그룹 5개, 기계 역할은 용도별로 1개.

| 종류 | 확정 이름 | 설명 |
|---|---|---|
| Group | `assac-network-admins` | 네트워크 |
| Group | `assac-data-security-admins` | DB·Secrets·GuardDuty |
| Group | `assac-app-deploy-admins` | WAS·Lambda·API |
| Group | `assac-edge-security-admins` | CloudFront·WAF·S3 정적 |
| Group | `assac-ops-admins` | Bastion·관측·Terraform |
| Role | `assac-role-terraform` | 로컬/CI Terraform |
| Role | `assac-role-github-actions` | GitHub OIDC |
| Role | `assac-role-was` | WAS 인스턴스 |
| Role | `assac-role-bastion` | Bastion |
| Role | `assac-role-lambda-waf-alert` | S1 |
| Role | `assac-role-lambda-chatbot` | S2 |
| Policy | `assac-policy-<역할-용도>` | 예: `assac-policy-was-ssm` |

그룹 이름만 복수형 `admins`를 쓴다. Role/Policy는 단수.

### 1.12 CI/CD · IaC

| # | 리소스 | 확정 이름 | Owner |
|---|---|---|---|
| I1 | Terraform workspace | `assac` | ops-admin |
| I2 | Terraform state 버킷 | `assac-terraform-state-<acct4>` | ops-admin |
| I3 | State lock 테이블 | `assac-terraform-lock` | ops-admin | DynamoDB. 앱 데이터가 아님 |
| I4 | GitHub repo / Actions | 리포 이름 유지 | app-deploy-admin | AWS 리소스 이름 아님 |

---

## 2. 새 리소스 이름 조합

인벤토리에 있으면 1장 이름을 쓴다.
인벤토리에 없어도 **이름을 만들어 준다.** 2장 규칙을 따른다.

### 2.0 자주 쓰는 조합

용도는 영어 소문자+하이픈. 한글을 음역하지 않고 의미를 짧게 옮긴다.

| 종류 | 형식 | 예 |
|---|---|---|
| Lambda | `assac-lambda-<기능>` | 부하테스트 → `assac-lambda-load-test` |
| | | 이미지 리사이즈 → `assac-lambda-image-resize` |
| API Gateway | `assac-apigw-<기능>` | `assac-apigw-load-test` |
| Security Group | `assac-sg-<용도>` | `assac-sg-load-test` |
| SNS | `assac-sns-<용도>` | `assac-sns-load-test` |
| CW Alarm | `assac-alarm-<지표>` | `assac-alarm-lambda-errors` |
| CW Log Group | `/assac/<서비스>` | `/assac/lambda-load-test` |
| IAM Role | `assac-role-<용도>` | `assac-role-lambda-load-test` |

### 2.1 허용 문자

- 소문자 `a-z`, 숫자 `0-9`, 하이픈 `-`만.
- 언더스코어 `_`, 대문자, 공백, 한글 금지.
- 하이픈으로 시작/끝 금지. 하이픈 연속 `--` 금지.
- `prod`, `dev`, `az-a` 금지. AZ는 마지막 한 글자 `a` 또는 `c`.
- 이름은 보통 `assac-`로 시작한다. **유일한 예외:** WAF CloudWatch 로그 그룹 `aws-waf-logs-assac`.

### 2.2 기본 형식

```
assac-<계층>-<용도>-<번호>
```

- 계층: 2.3 약어만. 새 약어는 이 표에 추가한 뒤에만 사용.
- 용도: 역할(`was`,`alb`) 또는 기능(`waf-alert`). 한 리소스에 역할이 있으면 앱 이름(`petclinic`)을 넣지 않는다.
- 번호: 같은 계층+용도가 **2개 이상**일 때만 `01`부터. 1개면 생략 (`assac-bastion`).
- `petclinic`을 넣어도 되는 곳은 RDS, Secrets, SNG, (해당 시) ECR뿐이다.

### 2.3 약어 (이 단어만)

| 약어 | 쓰는 곳 |
|---|---|
| vpc, igw, subnet, rt, nacl, nat, eip, sg | 네트워크 |
| public, was, db, alb, bastion, internal | 역할·구간 |
| lt, asg, tg, profile | 컴퓨트 |
| rds, sng | 데이터 |
| waf, cdn, cert | 엣지 |
| lambda, apigw, sns | 서버리스/메시징 |
| amp, amg, alarm, dashboard, budget | 관측 |
| role, policy, profile | IAM |
| static, logs, terraform-state, terraform-lock | 스토리지/IaC |

### 2.4 슬래시 예외와 AWS 강제 접두사

| 리소스 | 형식 | 예 |
|---|---|---|
| Secrets Manager | `assac/rds/<db명>` | `assac/rds/petclinic` |
| CloudWatch Log Group | `/assac/<서비스>` | `/assac/was` |
| CloudWatch Log Group (WAF만) | `aws-waf-logs-assac` | WAF→CloudWatch 연동. 접두사 `aws-waf-logs-`를 AWS가 강제한다 |

Secrets를 `assac-rds-petclinic`로 부르지 않는다.
일반 로그를 `assac-was`처럼 하이픈으로 부르지 않는다.
WAF 로그 그룹만 예외다. `/assac/waf-logs`나 `assac-waf-logs`가 아니라 `aws-waf-logs-assac`이다.

### 2.5 이름을 AWS가 정하는 리소스

우리가 정하는 값은 Comment 또는 Tag `Name`이다.

| 리소스 | 우리가 적는 값 |
|---|---|
| CloudFront Distribution | Comment `assac-cdn` |
| CloudFront VPC Origin | Comment `assac-vpc-origin` |
| ACM | Tag `Name=assac-cert` |
| GuardDuty detector | Tag `Name=assac-guardduty` |
| Bedrock | 이름 없음 |
| Route53 | 도메인 그대로 |

### 2.6 길이

만들 이름이 AWS 한도를 넘으면 용도를 줄이지 말고 팀에 공유한다. 임의로 `assac-waf-cf`처럼 축약하지 않는다.

---

## 3. 혼동 방지

| 사람이 말하는 것 | 맞는 리소스 | 틀린 답 |
|---|---|---|
| DB 서브넷 | `assac-subnet-db-a`, `assac-subnet-db-c` | `assac-sng-petclinic`, `assac-dbsubnet-petclinic` |
| DB 서브넷 그룹 / SNG | `assac-sng-petclinic` | `assac-subnet-db-*` |
| RDS / DB 인스턴스 | `assac-rds-petclinic` | 서브넷 이름 |
| WAS 서브넷 | `assac-subnet-was-a`, `assac-subnet-was-c` | `assac-was-01` |
| WAS 서버 / EC2 | `assac-was-01`, `assac-was-02` | 서브넷 이름 |
| 내부 ALB / ALB | `assac-alb-internal` | 퍼블릭 ALB |
| WAF | `assac-waf-cloudfront` | ALB WAF |
| 정적 버킷 | `assac-static-<acct4>` | terraform-state 버킷 |
| 로그 버킷 | `assac-logs-<acct4>` | Log Group |
| WAF 로그 | `aws-waf-logs-assac` | `/assac/waf-logs`, S3 로그 버킷 |
| Lambda | 기능까지 물어보고 S1/S2 중 하나 | 그냥 `assac-lambda` |
| 챗봇 API | `assac-apigw-chatbot` + `assac-lambda-chatbot` | 새 이름 창작 |

---

## 4. 태그

이름을 제안할 때 태그를 묻지 않아도 **항상 같이 적는다.**
필수 2개만. `Project`, `Environment` 금지.

| 키 | 값 | 규칙 |
|---|---|---|
| `Team` | `ASSAC` | 고정 |
| `Owner` | 아래 5개 중 하나 | 개인 이름 금지 |

Owner 허용 값: `network-admin`, `data-security-admin`, `app-deploy-admin`, `edge-security-admin`, `ops-admin`.
인벤토리 표의 Owner를 그대로 쓴다.

선택 태그:

| 키 | 값 | 언제 |
|---|---|---|
| `ManagedBy` | `terraform` 또는 `console` | Terraform 전환 추적용 |
| `AutoOnOff` | `true` / `false` | Bastion만 `true`가 기본 |

---

## 5. 운영 규칙

- 생성·삭제는 Slack에 한 줄. 삭제는 사전 공유 후.
- `terraform apply`는 채널 공유 후. state는 `assac-terraform-state-<acct4>`만. 로컬 state 금지.
- Terraform 관리 리소스는 콘솔에서 고치지 않는다.
- Access Key는 `.aws/credentials`만. Slack/GitHub 평문 금지. MFA 필수.
- Bastion은 `AutoOnOff=true`. 작업 끝나면 중지.

---

## 6. 한눈에 보는 확정 이름

```
네트워크
  assac-vpc
  assac-igw
  assac-subnet-public-a / public-c / was-a / was-c / db-a / db-c
  assac-rt-public / was / db
  assac-nacl-public / was / db
  assac-nat-a
  assac-eip-nat-a
  assac-sg-alb / was / db / bastion / lambda / apigw

컴퓨트
  assac-alb-internal
  assac-tg-was
  assac-lt-was
  assac-asg-was
  assac-was-01 / assac-was-02
  assac-bastion
  assac-sns-asg-alert

데이터
  assac-rds-petclinic
  assac-sng-petclinic
  assac/rds/petclinic

엣지·스토리지
  petclinic.hyeon.im
  assac-cdn (Comment) / assac-vpc-origin (Comment) / assac-cert (Tag)
  assac-waf-cloudfront
  assac-static-<acct4>
  assac-logs-<acct4>
  assac-terraform-state-<acct4>
  assac-terraform-lock

서버리스
  assac-lambda-waf-alert
  assac-lambda-chatbot
  assac-apigw-chatbot

로그·관측
  aws-waf-logs-assac
  /assac/was /alb /lambda-waf-alert /lambda-chatbot
  assac-dashboard
  assac-alarm-*
  assac-amp / assac-amg
```
