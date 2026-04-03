// 拼多多商品详情API代理
const crypto = require('crypto');
const querystring = require('querystring');

// 拼多多开放平台配置
const PDD_CONFIG = {
  apiUrl: 'https://gw-api.pinduoduo.com/api/router',
  clientId: process.env.PDD_CLIENT_ID,
  clientSecret: process.env.PDD_CLIENT_SECRET
};

// 生成签名
function generateSign(params, clientSecret) {
  const sortedKeys = Object.keys(params).sort();
  let signStr = clientSecret;
  for (const key of sortedKeys) {
    signStr += key + params[key];
  }
  signStr += clientSecret;
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

// 构建API请求参数
function buildApiParams(type, data) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    type: type,
    client_id: PDD_CONFIG.clientId,
    timestamp: timestamp.toString(),
    data_type: 'JSON',
    version: 'V1',
    ...data
  };
  params.sign = generateSign(params, PDD_CONFIG.clientSecret);
  return params;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const { goodsIdList } = req.query;
    
    if (!goodsIdList) {
      return res.status(400).json({
        error: '缺少商品ID列表',
        success: false
      });
    }

    if (!PDD_CONFIG.clientId || !PDD_CONFIG.clientSecret) {
      return res.status(500).json({
        error: 'API配置错误',
        success: false
      });
    }

    const apiParams = buildApiParams('pdd.ddk.goods.detail', {
      goods_id_list: `[${goodsIdList}]`
    });

    const response = await fetch(PDD_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: querystring.stringify(apiParams)
    });

    const data = await response.json();

    if (data.error_response) {
      return res.status(400).json({
        error: data.error_response.error_msg,
        error_code: data.error_response.error_code,
        success: false
      });
    }

    const goodsList = data.goods_detail_response?.goods_details || [];
    const formattedGoods = goodsList.map(item => ({
      id: item.goods_id,
      name: item.goods_name,
      image: item.goods_image_url,
      price: (item.min_group_price / 100).toFixed(2),
      originalPrice: (item.max_normal_price / 100).toFixed(2),
      hasCoupon: item.coupon_remain_quantity > 0,
      couponDiscount: (item.coupon_discount / 100).toFixed(2),
      sales: item.sales_tip,
      mallName: item.mall_name,
      desc: item.goods_desc,
      gallery: item.goods_gallery_urls || []
    }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      success: true,
      data: formattedGoods
    });

  } catch (error) {
    console.error('API调用错误:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: '服务器内部错误',
      message: error.message,
      success: false
    });
  }
};
