#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AlbWtgStack } from '../lib/alb_wtg-stack';

const app = new cdk.App();
new AlbWtgStack(app, 'AlbWtgStack');
