export const uploadYAMLToOSS = async (client:any ,content: string, configType: 'deployment' | 'service'): Promise<string> => {
  try {
    const timestamp = Date.now();
    const objectName = `k8s/${configType}/${timestamp}.yaml`;

    console.log("accessKeyId: ",client.accessKeySecret);
    console.log("accessKeySecret: ",client.accessKeySecret);
    console.log("bucket: ",client.bucket);
    
    // 创建 Blob 对象
    const blob = new Blob([content], { type: 'text/yaml' });
    
    const result = await client.put(objectName, blob);
    return objectName;
  } catch (error) {
    console.error('上传到 OSS 失败:', error);
    throw error;
  }
}; 