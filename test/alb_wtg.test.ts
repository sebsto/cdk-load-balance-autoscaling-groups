import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import cdk = require('@aws-cdk/core');
import AlbWtg = require('../lib/alb_wtg-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AlbWtg.AlbWtgStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});