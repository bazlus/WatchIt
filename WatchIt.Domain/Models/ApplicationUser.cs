using Microsoft.AspNetCore.Identity;

namespace WatchIt.Domain.Models
{
    using System.Collections.Generic;

    public class ApplicationUser : IdentityUser
    {
        public IEnumerable<Like> Likes { get; set; }
        
    }
}
