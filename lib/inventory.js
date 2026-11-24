import { S3Client, ListObjectsV2Command, ListBucketsCommand } from "@aws-sdk/client-s3";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { IAMClient, ListRolesCommand, ListPoliciesCommand, ListGroupsCommand } from "@aws-sdk/client-iam";
import { GlueClient, GetJobsCommand, GetCrawlersCommand, GetDatabasesCommand } from "@aws-sdk/client-glue";
import { KinesisClient, ListStreamsCommand } from "@aws-sdk/client-kinesis";
import { SchedulerClient, ListSchedulesCommand } from "@aws-sdk/client-scheduler";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { RDSClient, DescribeDBInstancesCommand, DescribeDBSubnetGroupsCommand } from "@aws-sdk/client-rds";
import {
  EC2Client,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  DescribeRouteTablesCommand,
  DescribeVpcEndpointsCommand,
} from "@aws-sdk/client-ec2";
import { SSMClient, DescribeParametersCommand } from "@aws-sdk/client-ssm";
import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";
import { FirehoseClient, ListDeliveryStreamsCommand } from "@aws-sdk/client-firehose";

const REGION = process.env.ASSAC_AWS_REGION || "ap-northeast-2";
const LAKE = "assac-datalake";
const CACHE_MS = 5 * 60 * 1000;
const LAYERS = ["raw", "clean", "mart", "state", "quarantine"];

let cache = { at: 0, text: "" };

function credentials() {
  const accessKeyId = process.env.ASSAC_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ASSAC_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

const ours = (name) => typeof name === "string" && /^(assac|sesac-lcc|\/assac)/.test(name);
const nameTag = (tags) => (tags || []).find((t) => t.Key === "Name")?.Value;

async function safe(label, fn) {
  try {
    return await fn();
  } catch (error) {
    return [`(${label} 조회 실패: ${error.name || "error"})`];
  }
}

async function listPrefixes(s3, prefix) {
  const out = await s3.send(
    new ListObjectsV2Command({ Bucket: LAKE, Prefix: prefix, Delimiter: "/", MaxKeys: 200 }),
  );
  return (out.CommonPrefixes || []).map((p) => p.Prefix.slice(prefix.length).replace(/\/$/, ""));
}

async function lakeLayout(s3) {
  const layers = await Promise.all(
    LAYERS.map(async (layer) => {
      const sources = await listPrefixes(s3, `${layer}/`);
      if (sources.length === 0) return null;
      const parts = await Promise.all(
        sources.slice(0, 30).map(async (source) => {
          const datasets = await listPrefixes(s3, `${layer}/${source}/`);
          const shown = datasets.filter((d) => !d.includes("=")).slice(0, 15);
          return shown.length ? `${source}(${shown.join(", ")})` : source;
        }),
      );
      return `${layer}/: ${parts.join(" · ")}`;
    }),
  );
  return layers.filter(Boolean);
}

async function collect() {
  const creds = credentials();
  if (!creds) return "";
  const cfg = { region: REGION, credentials: creds };
  const s3 = new S3Client(cfg);
  const iam = new IAMClient({ ...cfg, region: "us-east-1" });
  const ec2 = new EC2Client(cfg);
  const glue = new GlueClient(cfg);
  const rds = new RDSClient(cfg);

  const sections = await Promise.all([
    safe("S3 경로", async () => {
      const layout = await lakeLayout(s3);
      const raw = await listPrefixes(s3, "raw/");
      return [`데이터 소스(raw/ 폴더 = 현재 쓰는 소스 이름): ${raw.join(", ") || "없음"}`, ...layout];
    }),
    safe("S3 버킷", async () => {
      const out = await s3.send(new ListBucketsCommand({}));
      return [`S3 버킷: ${(out.Buckets || []).map((b) => b.Name).filter(ours).join(", ")}`];
    }),
    safe("Lambda", async () => {
      const out = await new LambdaClient(cfg).send(new ListFunctionsCommand({ MaxItems: 200 }));
      return [`Lambda: ${(out.Functions || []).map((f) => f.FunctionName).filter(ours).join(", ")}`];
    }),
    safe("스케줄", async () => {
      const out = await new SchedulerClient(cfg).send(new ListSchedulesCommand({ MaxResults: 100 }));
      return [`EventBridge 스케줄: ${(out.Schedules || []).map((s) => s.Name).filter(ours).join(", ")}`];
    }),
    safe("IAM", async () => {
      const [roles, policies, groups] = await Promise.all([
        iam.send(new ListRolesCommand({ MaxItems: 300 })),
        iam.send(new ListPoliciesCommand({ Scope: "Local", MaxItems: 300 })),
        iam.send(new ListGroupsCommand({ MaxItems: 100 })),
      ]);
      return [
        `IAM 역할: ${(roles.Roles || []).map((r) => r.RoleName).filter(ours).join(", ")}`,
        `IAM 정책: ${(policies.Policies || []).map((p) => p.PolicyName).filter(ours).join(", ")}`,
        `IAM 그룹: ${(groups.Groups || []).map((g) => g.GroupName).filter(ours).join(", ")}`,
      ];
    }),
    safe("Glue", async () => {
      const [jobs, crawlers, dbs] = await Promise.all([
        glue.send(new GetJobsCommand({ MaxResults: 100 })),
        glue.send(new GetCrawlersCommand({ MaxResults: 100 })),
        glue.send(new GetDatabasesCommand({ MaxResults: 100 })),
      ]);
      return [
        `Glue 작업: ${(jobs.Jobs || []).map((j) => j.Name).join(", ") || "없음"}`,
        `Glue 크롤러: ${(crawlers.Crawlers || []).map((c) => c.Name).join(", ") || "없음"}`,
        `Glue/Athena DB: ${(dbs.DatabaseList || []).map((d) => d.Name).join(", ") || "없음"}`,
      ];
    }),
    safe("스트림", async () => {
      const [ks, fh, ddb, sns] = await Promise.all([
        new KinesisClient(cfg).send(new ListStreamsCommand({})),
        new FirehoseClient(cfg).send(new ListDeliveryStreamsCommand({})),
        new DynamoDBClient(cfg).send(new ListTablesCommand({})),
        new SNSClient(cfg).send(new ListTopicsCommand({})),
      ]);
      return [
        `Kinesis: ${(ks.StreamNames || []).join(", ") || "없음"}`,
        `Firehose: ${(fh.DeliveryStreamNames || []).join(", ") || "없음"}`,
        `DynamoDB: ${(ddb.TableNames || []).filter(ours).join(", ") || "없음"}`,
        `SNS: ${(sns.Topics || []).map((t) => t.TopicArn.split(":").pop()).filter(ours).join(", ") || "없음"}`,
      ];
    }),
    safe("RDS", async () => {
      const [db, sng] = await Promise.all([
        rds.send(new DescribeDBInstancesCommand({})),
        rds.send(new DescribeDBSubnetGroupsCommand({})),
      ]);
      return [
        `RDS: ${(db.DBInstances || []).map((d) => `${d.DBInstanceIdentifier}(${d.Engine}, DB ${d.DBName || "-"})`).join(", ") || "없음"}`,
        `DB 서브넷 그룹: ${(sng.DBSubnetGroups || []).map((g) => g.DBSubnetGroupName).filter(ours).join(", ")}`,
      ];
    }),
    safe("네트워크", async () => {
      const [vpcs, subnets, sgs, rts, vpces] = await Promise.all([
        ec2.send(new DescribeVpcsCommand({})),
        ec2.send(new DescribeSubnetsCommand({})),
        ec2.send(new DescribeSecurityGroupsCommand({})),
        ec2.send(new DescribeRouteTablesCommand({})),
        ec2.send(new DescribeVpcEndpointsCommand({})),
      ]);
      const names = (items) => items.map((i) => nameTag(i.Tags) || i.GroupName).filter(ours).join(", ");
      return [
        `VPC: ${names(vpcs.Vpcs || [])}`,
        `서브넷: ${names(subnets.Subnets || [])}`,
        `보안 그룹: ${(sgs.SecurityGroups || []).map((g) => g.GroupName).filter(ours).join(", ")}`,
        `라우팅 테이블: ${names(rts.RouteTables || [])}`,
        `VPC 엔드포인트: ${names(vpces.VpcEndpoints || [])}`,
      ];
    }),
    safe("Parameter Store", async () => {
      const out = await new SSMClient(cfg).send(new DescribeParametersCommand({ MaxResults: 50 }));
      return [`Parameter Store(이름만): ${(out.Parameters || []).map((p) => p.Name).filter(ours).join(", ")}`];
    }),
  ]);

  const stamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return `조회 시각: ${stamp} (5분마다 갱신)\n${sections.flat().join("\n")}`;
}

export async function getLiveInventory() {
  if (cache.text && Date.now() - cache.at < CACHE_MS) return cache.text;
  try {
    const text = await Promise.race([
      collect(),
      new Promise((resolve) => setTimeout(() => resolve(""), 6000)),
    ]);
    if (text) cache = { at: Date.now(), text };
    return text || cache.text;
  } catch {
    return cache.text;
  }
}
