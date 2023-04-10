#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AlbWtgStack } from '../lib/alb_wtg-stack';

const app = new cdk.App();
new AlbWtgStack(app, 'AlbWtgStack');
