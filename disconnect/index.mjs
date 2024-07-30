import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocument.from(new DynamoDB());

export const handler = async (event) => {
  let response = await dynamo.scan({
    TableName: "Boards",
    FilterExpression: "connectionID = :connID",
    ExpressionAttributeValues: { ":connID": event.requestContext.connectionId },
  });
  
  if (response.Count > 0) {
    await dynamo.update({
      TableName: "Boards",
      Key: { partitionKey: response.Items[0].partitionKey },
      UpdateExpression: "REMOVE connectionID",
    });
    
    return {
      statusCode: 200,
    };
  }
  
 response = await dynamo.scan({
    TableName: "Controllers",
    FilterExpression: "connectionID = :connID",
    ExpressionAttributeValues: { ":connID": event.requestContext.connectionId },
  });
  
  if (response.Count > 0) {
    await dynamo.update({
      TableName: "Controllers",
      Key: { email: response.Items[0].email },
      UpdateExpression: "REMOVE connectionID",
    });
    
    return {
      statusCode: 200,
    };
  } 
  
  return {
    statusCode: 200
  };
};
