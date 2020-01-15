import cdk = require("@aws-cdk/core");
import ec2 = require("@aws-cdk/aws-ec2");
import docdb = require("@aws-cdk/aws-docdb");
import lambda = require("@aws-cdk/aws-lambda");
import apigateway = require("@aws-cdk/aws-apigateway");
import { IResource } from "@aws-cdk/core";

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

  /* REST API */
  private controllers: IControllers;
  private router: apigateway.RestApi;

  /******************************************************************** */
  /* Construction block                                                 */
  /******************************************************************** */
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* Network */
    this.vpc = this.createVPC();
    this.sg = this.createSecGroup();

    /* Database */
    this.subnetGroup = this.createSubnetGroup();
    this.dbCluster = this.createDbCluster();
    this.dbInstance = this.createDbInstance();

    this.DB_URL = `mongodb://${this.dbCluster.masterUsername}:${this.dbCluster.masterUserPassword}@${this.dbCluster.attrEndpoint}:${this.dbCluster.attrPort}`;
    this.DB_NAME = this.dbInstance.dbInstanceIdentifier as string;

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

    /* original routing code

    const urls = this.router.root.addResource("urls");
    const urlShortenerLambdaIntegration = new apigateway.LambdaIntegration(
      this.controllers.urlShortener
    );
    urls.addMethod("POST", urlShortenerLambdaIntegration);
    
    
    const singleURL = urls.addResource(`{id}`);
    const getLongURLLambdaIntegration = new apigateway.LambdaIntegration(
      this.controllers.getLongURL
    );
    singleURL.addMethod("GET", getLongURLLambdaIntegration);
    //*/

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
      vpc: this.vpc,
      code: new lambda.AssetCode("src"),
      handler: "urlShortener.handler",
      timeout: cdk.Duration.seconds(60),
      securityGroup: this.sg,
      environment: {
        DB_URL: this.DB_URL,
        DB_NAME: this.DB_NAME
      }
    });

    const getLongURL = new lambda.Function(this, "getLongURL", {
      functionName: "getLongURL",
      runtime: lambda.Runtime.NODEJS_12_X,
      vpc: this.vpc,
      code: new lambda.AssetCode("src"),
      handler: "getLongURL.handler",
      timeout: cdk.Duration.seconds(60),
      securityGroup: this.sg,
      environment: {
        DB_URL: this.DB_URL,
        DB_NAME: this.DB_NAME
      }
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
    parent: IResource, //apigateway.Resource,
    resourceName: string,
    controller: lambda.Function
  ): void => {
    const resource = parent.addResource(resourceName);
    const lambdaIntegration = new apigateway.LambdaIntegration(controller);
    resource.addMethod("POST", lambdaIntegration);
  };
}
