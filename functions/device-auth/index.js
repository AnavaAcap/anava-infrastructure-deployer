exports.device_authenticator = (req, res) => {
    res.status(200).json({
        status: 'Device auth endpoint working',
        timestamp: new Date().toISOString()
    });
};