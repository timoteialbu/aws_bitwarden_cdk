import { Stack, StackProps, aws_ec2, CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // VPC
    const vpc = new aws_ec2.Vpc(this, 'Bitwarden-VPC', {
      natGateways: 0,
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet-1',
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
      ],
    })

    // 👇 Create a SG for a web server
    const webserverSG = new aws_ec2.SecurityGroup(this, 'web-server-sg', {
      vpc,
      allowAllOutbound: true,
      description: 'security group for a web server',
    })

    webserverSG.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(22),
      'allow SSH access from anywhere'
    )

    webserverSG.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80),
      'allow HTTP traffic from anywhere'
    )

    webserverSG.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(443),
      'allow HTTPS traffic from anywhere'
    )

    // EC2
    const ec2Instance = new aws_ec2.Instance(this, `${id}-ec2`, {
      keyName: 'bitwarden',
      instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.T2, aws_ec2.InstanceSize.NANO),
      machineImage: aws_ec2.MachineImage.latestAmazonLinux({
        generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpc,
      securityGroup: webserverSG,
    })

    // Elastic IP
    let elasticIp = new aws_ec2.CfnEIP(this, 'BitwardenIP')

    new aws_ec2.CfnEIPAssociation(this, 'Ec2Association', {
      eip: elasticIp.ref,
      instanceId: ec2Instance.instanceId,
    })

    // // Hosted Zone
    // const hostedZone = aws_route53.HostedZone.fromLookup(this, 'MyZone', {
    //   domainName: 'timoteialbu.com',
    // })

    // // New record set
    // new aws_route53.ARecord(this, 'recordSet', {
    //   zone: hostedZone,
    //   recordName: 'bitwarden.timoteialbu.com',
    //   target: aws_route53.RecordTarget.fromIpAddresses(elasticIp.ref),
    // })
    new CfnOutput(this, 'Elastic IP', {
      value: elasticIp.ref,
      exportName: 'BitwardenElasticIP',
    })
  }
}
