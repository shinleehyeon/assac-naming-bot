# ASSAC petclinic 3-tier 아키텍처

이름 확정값은 `ASSAC_naming_convention.md` 1장이 기준이다. 이 문서는 배치와 트래픽만 설명한다.

- 리전: `ap-northeast-2`
- 도메인: `petclinic.hyeon.im`
- AZ: **a, c만**
- 퍼블릭 ALB 없음. 인터넷 노출은 CloudFront + WAF
- NAT는 AZ-a 하나
- 이름에 `prod` / `dev` 없음

## 트래픽

1. 사용자 → Route53 → CloudFront
2. CloudFront path routing
   - 정적 → `assac-static-<acct4>`
   - 앱 → VPC Origin → `assac-alb-internal` → `assac-tg-was` → `assac-asg-was`
3. WAF(`assac-waf-cloudfront`) → `aws-waf-logs-assac` → `assac-lambda-waf-alert` → Slack

## 서브넷 배치

| 서브넷 | 위치 리소스 |
|---|---|
| `assac-subnet-public-a` | `assac-nat-a`, `assac-bastion` |
| `assac-subnet-public-c` | 퍼블릭 예비 |
| `assac-subnet-was-a` | WAS-01, ASG, SNS |
| `assac-subnet-was-c` | WAS-02, `assac-apigw-chatbot`, `assac-lambda-chatbot` → Bedrock |
| `assac-subnet-db-a` | RDS 한쪽, `assac/rds/petclinic` |
| `assac-subnet-db-c` | RDS 다른쪽 |

WAS 아웃바운드는 `assac-nat-a`. RDS는 Multi-AZ 한 세트 `assac-rds-petclinic`.

## 옆에 붙는 것

- 관측: CloudWatch, `assac-amp`, `assac-amg`, GuardDuty, Budget
- IaC: GitHub → GitHub Actions → Terraform (`assac` workspace)

## 이 그림에 없는 것

다이어그램 기본 구성에는 ECS, 앱 DynamoDB, SQS, 퍼블릭 ALB, AZ-c NAT가 없다.
그래도 이름을 물으면 거절하지 말고 네이밍 문서 2장으로 조합한다. 예: 부하테스트 Lambda → `assac-lambda-load-test`.
기존 확정 리소스(서브넷 6개, NAT는 a만 등)와 충돌하는 이름은 만들지 않는다.
