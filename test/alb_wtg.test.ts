// import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import { Template, Match } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AlbWtgStack } from '../lib/alb_wtg-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AlbWtgStack(app, 'MyTestStack');
    // THEN
    const actual = app.synth().getStackArtifact(stack.artifactId).template;
    expect(actual.Resources ?? {}).toEqual({});
});