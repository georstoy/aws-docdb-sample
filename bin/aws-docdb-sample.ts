#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AwsDocdbSampleStack } from '../lib/aws-docdb-sample-stack';

const app = new cdk.App();
new AwsDocdbSampleStack(app, 'AwsDocdbSampleStack');
