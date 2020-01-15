import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");

const vpcCidr = "10.0.0.0/21";
const port = 27017;

let vpc:ec2.Vpc;
let sg:ec2.SecurityGroup;

export const createVPC = (scope: cdk.Construct):ec2.Vpc => {
  vpc = new ec2.Vpc(scope, "vpc", {
    cidr: vpcCidr,
    subnetConfiguration: [
      {
        subnetType: ec2.SubnetType.PRIVATE,
        cidrMask: 24,
        name: "PrivateSubnet1"
      },
      {
        subnetType: ec2.SubnetType.PRIVATE,
        cidrMask: 24,
        name: "PrivateSubnet2"
      },
      {
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 28,
        name: "PublicSubnet1"
      }
    ]
  });
  return vpc;
};

export const createSecGroup = (scope: cdk.Construct):ec2.SecurityGroup => {
  sg = new ec2.SecurityGroup(scope, "docdb-lambda-sg", {
    vpc,
    securityGroupName: "docdb-lambda-sg"
  });
  sg.addIngressRule(ec2.Peer.ipv4(vpcCidr), ec2.Port.tcp(port));
  return sg;
};
