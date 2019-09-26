import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import assets = require('@aws-cdk/aws-s3-assets');
import elbv2  = require('@aws-cdk/aws-elasticloadbalancingv2');

import { Fn, Tag, Resource } from '@aws-cdk/core';
import { AmazonLinuxImage, UserData, Peer, Port } from '@aws-cdk/aws-ec2';
import { Role, ServicePrincipal, ManagedPolicy, CfnInstanceProfile } from '@aws-cdk/aws-iam'
import { IApplicationLoadBalancerTarget, ApplicationTargetGroup, LoadBalancerTargetProps, TargetType } from '@aws-cdk/aws-elasticloadbalancingv2';

/**
 * Create my own Ec2 resource and Ec2 props as these are not yet defined in CDK
 * These classes abstract low level details from CloudFormation
 */
class Ec2InstanceProps {
  readonly image : ec2.IMachineImage;
  readonly instanceType : ec2.InstanceType;
  readonly userData : UserData;
  readonly subnet : ec2.ISubnet;
  readonly role : Role;
  readonly securityGroup : ec2.SecurityGroup;
}
class Ec2 extends Resource implements IApplicationLoadBalancerTarget {
  readonly instance : ec2.CfnInstance;
  readonly props? : Ec2InstanceProps;
  constructor(scope: cdk.Construct, id: string, props? : Ec2InstanceProps) {
    super(scope, id);
    this.props = props;
    if (props) {

      //create a profile to attch the role to the instance
      const profile = new CfnInstanceProfile(this, `${id}Profile`, {
        roles: [ props.role.roleName ]
      });
      
      // create the instance
      this.instance = new ec2.CfnInstance(this, id, {
        imageId: props.image.getImage(this).imageId,
        instanceType: props.instanceType.toString(),
        networkInterfaces: [
          {
            deviceIndex: "0",
            subnetId: props.subnet.subnetId,
            groupSet: [props.securityGroup.securityGroupId]
          }
        ]
        ,userData: Fn.base64(props.userData.render())
        ,iamInstanceProfile: profile.ref
      });

      // tag the instance
      Tag.add(this.instance, 'Name', `${AlbWtgStack.name}/${id}`);

    }
  }

  attachToApplicationTargetGroup(targetGroup: ApplicationTargetGroup): LoadBalancerTargetProps {
   return { targetType : TargetType.INSTANCE,
            targetJson : {
              id: this.instance.ref,
              port: 80, //how to pass actual application's port ?
              availabilityzone: this.props!.subnet.availabilityZone,
            }
   };  
  }

}



export class AlbWtgStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //
    // create VPC w/ public and private subnets in 2 AZ
    // this also creates a NAT Gateway
    //
    const vpc = new ec2.Vpc(this, 'NewsBlogVPC', {
      maxAzs : 2
    });
    const privateSubnet0 = vpc.privateSubnets[0];
    const privateSubnet1 = vpc.privateSubnets[1];

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

    //
    // create the security for the load balancer 
    //
    // let lbSG = new ec2.SecurityGroup(this, 'NewsBlogExternalLBSG', {
    //   description: 'Load Balanacer Security Group',
    //   vpc: vpc
    // });
    // lbSG.addIngressRule(Peer.ipv4('0.0.0.0/0'), Port.tcp(80), 'allow http access from any ipv4 ip');

    //
    // create the security group for the instances 
    //
    let sg = new ec2.SecurityGroup(this, 'NewsBlogInternalEC2SG', {
      description: 'EC2 Security Group',
      vpc: vpc
    });
    // sg.addIngressRule(lbSG, Port.tcp(80), `allow HTTP access from Load Balancer SG`);
    
    //
    // launch the blue and green EC2 instance in the private subnets
    //
    var targets : Ec2[] = [];
    for (let env of ["green", "blue"]) {

        // define a user data script to install & launch our web server
        const userData = UserData.forLinux();
        userData.addCommands('yum install -y nginx', 'chkconfig nginx on', 'service nginx start');
        userData.addCommands(`aws s3 cp s3://${asset.s3BucketName}/${asset.s3ObjectKey} .`, 
                             `unzip *.zip`, 
                             `/bin/cp -r -n /usr/share/nginx/html/index.html /usr/share/nginx/html/index.html.orig`,
                             `/bin/cp -r -n ${env}/* /usr/share/nginx/html/`);

        var i = new Ec2(this, `NewsBlogInstance-${env}`, {
          image: new AmazonLinuxImage(),
          instanceType : ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
          subnet : (env === 'green' ? privateSubnet0 : privateSubnet1),
          userData : userData,
          role: role,
          securityGroup : sg
        })  
        targets.push(i);  
    }

    //
    // create the load balancer 
    //
    const lb = new elbv2.ApplicationLoadBalancer(this, 'NewsBlogLoadBalancer', {
      vpc,
      internetFacing: true
    });

    const listener = lb.addListener('NewsBlogListener', {
      port: 80,
    });

    listener.addTargets('Target', {
      port: 80,
      targets: targets
    });

    // this construct creates the LB Security Group,
    // these two lnes configure the ingress and egress rules
    listener.connections.allowFromAnyIpv4(Port.tcp(80));
    listener.connections.allowTo(Peer.anyIpv4(), Port.allTcp());

    // add the LB security group as allowed source to the EC2 instance security group
    listener.connections.securityGroups.forEach(secGroup => {
      sg.addIngressRule(secGroup, Port.tcp(80), `allow HTTP access from Load Balancer SG`);
    });

  }
}
