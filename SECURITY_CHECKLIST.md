# Security Checklist for Anava Infrastructure Deployer

## ✅ Already Fixed (as of v0.9.170)
- [x] **Firestore Security Rules** - Removed temporary authentication bypass
- [x] **Credential Logging** - Passwords and API keys are now masked in logs
- [x] **Electron Context Isolation** - Already enabled for security
- [x] **Node Integration** - Disabled in renderer process

## 🔒 Before Production Deployment

### Critical Security Items
1. **Review IAM Permissions**
   - [ ] Verify service accounts use minimum required permissions
   - [ ] Remove any Owner/Admin roles not absolutely necessary
   - [ ] Document why each permission is needed

2. **Protect API Keys**
   - [ ] Never commit API keys to source control
   - [ ] Rotate API keys regularly
   - [ ] Use API key restrictions in GCP Console

3. **Network Security**
   - [ ] Keep cameras on isolated network segment
   - [ ] Use VPN for remote camera access
   - [ ] Enable firewall rules for GCP resources

4. **Authentication**
   - [ ] Enable 2FA for Google accounts
   - [ ] Use strong passwords for camera credentials
   - [ ] Regularly audit user access

## ⚠️ Known Limitations

### Camera Communication
- Cameras use HTTP (not HTTPS) on local networks
- This is standard for Axis cameras on private networks
- Ensure cameras are not exposed to the internet

### Credential Storage
- Camera credentials are stored locally on the installer machine
- Use full disk encryption on computers running the installer
- Future versions will add credential encryption

### Service Account Permissions
- Some service accounts currently have elevated permissions
- This is required for the complex deployment process
- Review and reduce permissions after initial setup

## 📋 Deployment Best Practices

1. **Pre-Deployment**
   - [ ] Test in a non-production project first
   - [ ] Review all generated infrastructure
   - [ ] Verify Firestore rules are properly configured

2. **During Deployment**
   - [ ] Monitor Cloud Build logs for errors
   - [ ] Verify all services deploy successfully
   - [ ] Test authentication flow immediately

3. **Post-Deployment**
   - [ ] Remove unnecessary service account keys
   - [ ] Enable audit logging in GCP
   - [ ] Set up monitoring and alerts
   - [ ] Review and tighten Firestore rules for your use case

## 🚨 Security Incident Response

If you suspect a security breach:
1. Immediately rotate all API keys
2. Review GCP audit logs
3. Check Firestore for unauthorized access
4. Disable compromised service accounts
5. Contact security@anava.ai

## 📝 Regular Security Tasks

### Weekly
- [ ] Review GCP audit logs
- [ ] Check for unusual Firestore activity
- [ ] Verify camera credentials are secure

### Monthly
- [ ] Rotate API keys
- [ ] Review IAM permissions
- [ ] Update dependencies (`npm audit`)

### Quarterly
- [ ] Full security audit
- [ ] Review and update Firestore rules
- [ ] Test disaster recovery procedures

## 🔐 Data Protection

### Sensitive Data Locations
- **Camera Credentials**: Stored in Electron app data directory
- **GCP Credentials**: Stored in OAuth tokens
- **License Keys**: Cached locally after generation
- **Firebase Config**: Embedded in deployed infrastructure

### Recommendations
1. Enable full disk encryption on installer machines
2. Use separate GCP projects for dev/staging/production
3. Implement data retention policies in Firestore
4. Regular backups of critical configuration

## 📞 Support

For security questions or to report vulnerabilities:
- Email: security@anava.ai
- Do not post security issues publicly on GitHub

---

*Last Updated: January 2025*
*Version: 0.9.170*