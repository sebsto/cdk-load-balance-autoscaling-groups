# Create a Load Balancer and two AutoScaling Group

This code creates an [Application Load Balancer](https://docs.aws.amazon.com/en_pv/elasticloadbalancing/latest/application/application-load-balancer-getting-started.html) and Two [Auto Scaling groups](https://docs.aws.amazon.com/en_pv/autoscaling/ec2/userguide/AutoScalingGroup.html).  It serves as basis to configure blue / green deployments.

## Getting started 

### Initial tasks (to execute only once) 

- Install CDK : https://docs.aws.amazon.com/en_pv/cdk/latest/guide/getting_started.html 
```bash
npm install -g aws-cdk
```

- Bootstrap the CDK environment
```bash
cdk boostrap
```

### For each redeployment 

- Build the code 
```bash
npm run build
```

- Deploy the code 
```bash
cdk deploy
```

### Cleanup

To cleanup the environment when you are done testing :
```bash
cdk destroy
```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
