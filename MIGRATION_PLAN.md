# Drupal 7 to Backdrop CMS Migration Plan

## Project Overview

This document outlines the complete migration plan for upgrading the randyfay.com Drupal 7 site to Backdrop CMS. The migration is required due to Drupal 7's end-of-life (January 2025) and the need for continued security support.

## Current Site Analysis

### Drupal 7 Core
- Standard Drupal 7 installation
- Located in `/docroot/` directory
- No core modifications detected

### Contrib Modules (25 identified)
```
admin_menu          → Available in Backdrop core (Admin Bar)
backup_migrate      → Available for Backdrop
codefilter         → Available for Backdrop
comment_notify     → Available for Backdrop
contact_reply_to   → Available for Backdrop
context            → Available for Backdrop
css_injector       → Available for Backdrop
ctools             → Available for Backdrop
diff               → Available for Backdrop
entity             → Available for Backdrop
environment_indicator → Available for Backdrop
gist_filter        → Available for Backdrop
insert             → Available for Backdrop
logintoboggan      → Available for Backdrop
markdown           → Available for Backdrop
module_filter      → Available for Backdrop
pathauto           → Integrated into Backdrop core (Path module)
reroute_email      → Available for Backdrop
rules              → Available for Backdrop
smtp               → Available for Backdrop
spambot            → Available for Backdrop
tag1quo            → Will be removed (obsolete)
token              → Available for Backdrop
views              → Available in Backdrop core
views_bulk_operations → Available for Backdrop
```

### Custom Theme
- **Corolla Theme**: Will be abandoned
- Location: `/docroot/sites/all/themes/corolla/`
- Will select a suitable Backdrop theme for replacement

### Custom Code
- **No custom modules identified**
- All detected modules are contrib modules

## Migration Strategy

### Phase 1: DDEV Environment Setup

1. **Set Up DDEV Backdrop Project**
   ```bash
   # Create new DDEV project for Backdrop
   ddev config --project-type=backdrop
   ddev start
   ```

2. **Download Backdrop CMS**
   - Download latest Backdrop CMS to docroot
   - DDEV will automatically configure database settings
   - DDEV creates settings.ddev.php for database connection

### Phase 2: Database Migration

1. **Install Backdrop CMS in DDEV**
   - Download from https://backdropcms.org/
   - Extract to docroot directory
   - DDEV handles database configuration via settings.ddev.php

2. **Import Drupal 7 Database**
   ```bash
   # Export current D7 database
   ddev export-db --file=drupal7_backup.sql
   
   # Import to Backdrop database
   ddev import-db --file=drupal7_backup.sql
   ```

3. **Run Backdrop Upgrade Script**
   - Navigate to `/core/update.php`
   - Follow upgrade wizard
   - Database will be converted from D7 to Backdrop format

### Phase 3: Module Migration

1. **Update Module Info Files**
   For each contrib module, update the .info file:
   ```
   # Change from:
   core = 7.x
   
   # Change to:
   backdrop = 1.x
   ```

2. **Download Backdrop Versions**
   - Download Backdrop versions of contrib modules
   - Place in `/modules/` directory
   - Enable modules through admin interface

3. **Special Considerations**
   - **Admin Menu**: Already included in Backdrop core as "Admin Bar"
   - **Pathauto**: Features integrated into core Path module
   - **Views**: Included in Backdrop core
   - **Tag1quo**: Remove completely (obsolete module)

### Phase 4: Theme Selection

1. **Abandon Corolla Theme**
   - Remove existing custom theme
   - Select appropriate Backdrop theme that provides similar functionality

2. **New Theme Setup**
   - Install chosen Backdrop theme
   - Configure theme settings to match site requirements
   - Customize as needed for site branding

### Phase 5: Content and Configuration Verification

1. **Content Audit**
   - Verify all nodes migrated correctly
   - Check user accounts and permissions
   - Validate taxonomy terms and vocabulary
   - Test file uploads and media

2. **Functionality Testing**
   - Test all forms and user interactions
   - Verify Views and content displays
   - Test administrative functions
   - Check email functionality (SMTP, contact forms)

3. **Performance Testing**
   - Enable caching
   - Test page load times
   - Verify mobile responsiveness

### Phase 6: Go-Live

1. **Production Backup**
   - Full database and file backup
   - Document rollback procedure

2. **DNS and Deployment**
   - Upload Backdrop code to production
   - Import database
   - Run update script
   - Update DNS if necessary

3. **Post-Launch Monitoring**
   - Monitor error logs
   - Test critical functionality
   - User acceptance testing

## Risk Assessment

### Low Risk Items
- Standard contrib modules (high compatibility)
- Content migration (direct database upgrade)
- No custom modules to port

### Medium Risk Items
- Theme replacement and styling adjustments
- Some contrib modules may need manual updates
- Drupal Compatibility Layer dependency

### High Risk Items
- **None identified** - This is a relatively low-risk migration

## Post-Migration Tasks

1. **Security Updates**
   - Apply latest Backdrop security updates
   - Configure automatic update notifications

2. **Optimization**
   - Enable Backdrop-specific performance features
   - Configure caching strategies
   - Remove Drupal compatibility layer when possible

3. **Documentation**
   - Update site documentation
   - Train content editors on any interface changes
   - Document new admin procedures

## Resources and Documentation

- [Backdrop CMS Upgrade Documentation](https://docs.backdropcms.org/documentation/upgrading-from-drupal-7-overview)
- [Module Conversion Guide](https://docs.backdropcms.org/converting-modules-from-drupal)
- [Backdrop CMS Community Forum](https://forum.backdropcms.org/)

## Support Contacts

- Backdrop CMS Community: https://forum.backdropcms.org/
- Backdrop CMS Documentation: https://docs.backdropcms.org/
- Emergency Rollback Contact: [Add contact information]

---

**Document Version**: 1.0  
**Last Updated**: September 17, 2025  
**Prepared By**: Claude Code Analysis