// Quick smoke test for the calculator_link_node handler.
// Runs the pricing + saveAs end-to-end against calculator.aws.
// Usage: node agent/lambdas/calculator_link_node/_smoke_test.mjs
import { handler } from "./index.mjs";

const event = {
  name: "Doc Agent smoke test",
  region: "ap-northeast-2",
  services: [
    {
      service_name: "AWS Lambda",
      service_code: "aWSLambda",
      templateId: "lambdaWithFreeTier",
      config: {
        noOfRequests: { value: 10, unit: "millionPerMonth" },
        lambdaDurationTime: { value: 200, unit: "ms" },
        memoryRequired: { value: 512, unit: "MB" },
      },
    },
    {
      service_name: "S3 Standard",
      service_code: "amazonS3",
      config: {
        storageAmount: { value: 100, unit: "GB" },
      },
    },
    {
      service_name: "Unsupported test",
      service_code: "",
      monthly_cost_hint: 42,
    },
  ],
};

const result = await handler(event);
console.log(JSON.stringify(result, null, 2));
