import cdk = require("@aws-cdk/core");
import docdb = require("@aws-cdk/aws-docdb");



const subnetGroup = new docdb.CfnDBSubnetGroup(this, "subnet-group", {
  subnetIds: vpc.privateSubnets.map(x => x.subnetId),
  dbSubnetGroupName: "subnet-group",
  dbSubnetGroupDescription: "Subnet Group for DocDB"
});
const dbCluster = new docdb.CfnDBCluster(this, "db-cluster", {
  storageEncrypted: true,
  availabilityZones: vpc.availabilityZones.splice(3),
  dbClusterIdentifier: "docdb",
  masterUsername: "dbuser",
  masterUserPassword: process.env.MASTER_USER_PASSWORD,
  vpcSecurityGroupIds: [sg.securityGroupName],
  dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
  port
});
dbCluster.addDependsOn(subnetGroup);

const dbInstance = new docdb.CfnDBInstance(this, "db-instance", {
  dbClusterIdentifier: dbCluster.ref,
  autoMinorVersionUpgrade: true,
  dbInstanceClass: "db.r5.large",
  dbInstanceIdentifier: "staging"
});
dbInstance.addDependsOn(dbCluster);
