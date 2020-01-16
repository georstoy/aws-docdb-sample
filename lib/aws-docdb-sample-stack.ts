import { readFileSync } from "fs";

import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import docdb = require("@aws-cdk/aws-docdb");
import lambda = require("@aws-cdk/aws-lambda");
import apigateway = require("@aws-cdk/aws-apigateway");

interface IControllers {
  urlShortener: lambda.Function;
  getLongURL: lambda.Function;
}

export class AwsDocdbSampleStack extends cdk.Stack {
  /******************************************************************** */
  /* Declaration block                                                  */
  /*  - Configurable Construct Parameters                               */
  /*  - Constructs                                                      */
  /******************************************************************** */
  /* Network */
  private vpcCidr = "10.0.0.0/21";
  private port = 27017;

  private vpc: ec2.Vpc;
  private sg: ec2.SecurityGroup;

  /* Database */
  private masterUsername: string = process.env.MASTER_USER || "dbuser";
  private masterUserPassword: string =
    process.env.MASTER_USER_PASSWORD || "dbpassword";

  private subnetGroup: docdb.CfnDBSubnetGroup;
  private dbCluster: docdb.CfnDBCluster;
  private dbInstance: docdb.CfnDBInstance;

  private DB_URL: string;
  private DB_NAME: string;
  private DB_CLIENT_OPTIONS: string;

  /* REST API */
  private controllers: IControllers;
  private router: apigateway.RestApi;

  /******************************************************************** */
  /* Construction block                                                 */
  /*  - here the order of execution is of great importance              */
  /*  - if used console.log will output in the template.yml             */
  /******************************************************************** */
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* Network */
    this.vpc = this.createVPC();
    this.sg = this.createSecGroup();

    /* Database */
    this.subnetGroup = this.createSubnetGroup();
    
    if (process.env.ENVIRONMENT === 'dev') {
      this.DB_URL = 'mongodb://potrebitel:parola@localhost:27017';
      this.DB_NAME = 'urls';
      this.DB_CLIENT_OPTIONS = JSON.stringify({ useUnifiedTopology: true });
    } 
    
    if (process.env.ENVIRONMENT === 'prod') {
      this.dbCluster = this.createDbCluster();
      this.dbInstance = this.createDbInstance();
      this.DB_URL = `mongodb://${this.dbCluster.masterUsername}:${this.dbCluster.masterUserPassword}@${this.dbCluster.attrEndpoint}:${this.dbCluster.attrPort}`;
      this.DB_NAME = this.dbInstance.dbInstanceIdentifier as string;
      const ca = [readFileSync(`${__dirname}/rds-combined-ca-bundle.pem`)];
      this.DB_CLIENT_OPTIONS = JSON.stringify({ ssl: true, sslValidate: true, sslCA: ca, useNewUrlParser: true});
    } 

    /* Controllers */
    this.controllers = this.createControllers();

    /* Routing */
    this.router = this.createRouter();

    this.attachController(
      "POST",
      this.router.root,
      "urls",
      this.controllers.urlShortener
    );
    this.attachController(
      "GET",
      this.router.root,
      "{id}",
      this.controllers.getLongURL
    );

    new cdk.CfnOutput(this, "db-url", {
      value: this.DB_URL
    });
  }

  /******************************************************************** */
  /* Definition of methods, used in the constructor                     */
  /******************************************************************** */
  /* Network */
  private createVPC = (): ec2.Vpc => {
    const vpc = new ec2.Vpc(this, "vpc", {
      cidr: this.vpcCidr,
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

  private createSecGroup = (): ec2.SecurityGroup => {
    const sg = new ec2.SecurityGroup(this, "docdb-lambda-sg", {
      vpc: this.vpc,
      securityGroupName: "docdb-lambda-sg"
    });
    sg.addIngressRule(ec2.Peer.ipv4(this.vpcCidr), ec2.Port.tcp(this.port));
    return sg;
  };

  /* Database */
  private createSubnetGroup = (): docdb.CfnDBSubnetGroup => {
    const subnetGroup = new docdb.CfnDBSubnetGroup(this, "subnet-group", {
      subnetIds: this.vpc.privateSubnets.map(x => x.subnetId),
      dbSubnetGroupName: "subnet-group",
      dbSubnetGroupDescription: "Subnet Group for DocDB"
    });
    return subnetGroup;
  };

  private createDbCluster = (): docdb.CfnDBCluster => {
    const dbCluster = new docdb.CfnDBCluster(this, "db-cluster", {
      storageEncrypted: true,
      availabilityZones: this.vpc.availabilityZones.splice(3),
      dbClusterIdentifier: "docdb",
      masterUsername: this.masterUsername,
      masterUserPassword: this.masterUserPassword,
      vpcSecurityGroupIds: [this.sg.securityGroupName],
      dbSubnetGroupName: this.subnetGroup.dbSubnetGroupName,
      port: this.port
    });
    dbCluster.addDependsOn(this.subnetGroup);
    return dbCluster;
  };

  private createDbInstance = (): docdb.CfnDBInstance => {
    const dbInstance = new docdb.CfnDBInstance(this, "db-instance", {
      dbClusterIdentifier: this.dbCluster.ref,
      autoMinorVersionUpgrade: true,
      dbInstanceClass: "db.r5.large",
      dbInstanceIdentifier: "staging"
    });
    dbInstance.addDependsOn(this.dbCluster);
    return dbInstance;
  };

  /* Controllers */
  private createControllers = (): IControllers => {
    const urlShortener = new lambda.Function(this, "urlShortener", {
      functionName: "urlShortener",
      runtime: lambda.Runtime.NODEJS_12_X,
      code: new lambda.AssetCode("src"),
      handler: "urlShortener.handler",
      environment: {
        DB_URL: this.DB_URL,
        DB_NAME: this.DB_NAME,
        DB_CLIENT_OPTIONS: this.DB_CLIENT_OPTIONS
      },
      timeout: cdk.Duration.seconds(60),
      vpc: this.vpc,
      securityGroup: this.sg
    });

    const getLongURL = new lambda.Function(this, "getLongURL", {
      functionName: "getLongURL",
      runtime: lambda.Runtime.NODEJS_12_X,
      code: new lambda.AssetCode("src"),
      handler: "getLongURL.handler",
      environment: {
        DB_URL: this.DB_URL,
        DB_NAME: this.DB_NAME,
        DB_CLIENT_OPTIONS: this.DB_CLIENT_OPTIONS
      },
      timeout: cdk.Duration.seconds(60),
      vpc: this.vpc,
      securityGroup: this.sg
    });

    return { urlShortener, getLongURL };
  };

  /* Routing */
  private createRouter = (): apigateway.RestApi => {
    const api = new apigateway.RestApi(this, "api", {
      restApiName: "url-shortener"
    });

    return api;
  };

  private attachController = (
    httpMethod: string,
    parent: apigateway.IResource,
    resourceName: string,
    controller: lambda.Function
  ): void => {
    const resource = parent.addResource(resourceName);
    const lambdaIntegration = new apigateway.LambdaIntegration(controller);
    resource.addMethod("POST", lambdaIntegration);
  };
}
