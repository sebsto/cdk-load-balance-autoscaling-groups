import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2    from 'aws-cdk-lib/aws-ec2';
import * as assets from 'aws-cdk-lib/aws-s3-assets';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2       from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { UserData } from 'aws-cdk-lib/aws-ec2';

export class AlbWtgStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //
    // create VPC w/ public and private subnets in 2 AZ
    // this also creates a NAT Gateway
    //
    const vpc = new ec2.Vpc(this, 'NewsBlogVPC', {
      maxAzs : 2
    });

    //
    // create HTML web site as S3 assets 
    //
    var path = require('path');
    const asset = new assets.Asset(this, 'SampleAsset', {
      path: path.join(__dirname, '../html')
    });

    //
    // define the IAM role that will allow the EC2 instance to download web site from S3 
    //
    const role = new Role(this, 'NewsBlogRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com')
    });
    // allow instance to communicate with s3
    asset.grantRead(role);
    // allow system manager agent to make api calls to systems manager 
    role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // create the auto scaling groups with 2 instances each.
    const autoScalingGroups : autoscaling.AutoScalingGroup[] = [];
    for (let env of ["green", "blue"]) {

        // define a user data script to install & launch our web server
        const userData = UserData.forLinux();
        userData.addCommands('yum install -y nginx', 'chkconfig nginx on', 'service nginx start');
        userData.addCommands(`aws s3 cp s3://${asset.s3BucketName}/${asset.s3ObjectKey} .`, 
                             `unzip *.zip`, 
                             `/bin/mv /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
                             `/bin/cp -r -n ${env}/* /usr/share/nginx/html/`);

        // create an auto scaling group for each environment
        const asg = new autoscaling.AutoScalingGroup(this, `NewsBlogAutoScalingGroup--${env}`, {
          vpc,
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
          machineImage: new ec2.AmazonLinuxImage(),
          desiredCapacity: 2,
          role: role,
          userData: userData
        });

        autoScalingGroups.push(asg);

    }

    // create a load balancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('Listener', {
      port: 80,
    });

    listener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    autoScalingGroups.forEach(asg => {
      listener.addTargets(`Targets-${asg}`, {
        port: 80,
        targets: [asg]
      });
    });

    // add a scaling rule
    autoScalingGroups.forEach(asg => {
      asg.scaleOnRequestCount(`AModestLoad-${asg}`, {
        targetRequestsPerMinute: 1
      });
    });

    // autoScalingGroups.forEach(asg => {
    //   // create a load balancer Target Group for each auto scaling group 
    //   listener.addTargets(`Target-${asg}`, {
    //     port: 80,
    //     targets: [asg],
    //   });    

    //   // add a scaling rule
    //   asg.scaleOnRequestCount(`AModestLoad-${asg}`, {
    //     targetRequestsPerSecond: 1
    //   });
    // });


  }    
}
